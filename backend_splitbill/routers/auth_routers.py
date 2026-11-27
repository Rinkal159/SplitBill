from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    HTTPException,
    status,
    Cookie,
    Request,
)
from backend_splitbill.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, update, delete
from sqlalchemy.exc import IntegrityError
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from starlette.concurrency import run_in_threadpool
import os
from dotenv import load_dotenv
from backend_splitbill.services.cloudinary import (
    upload_picture_on_cloudinary,
    upload_google_picture_on_cloudinary,
)
from backend_splitbill.services.hash_password_otp import hash, verify
from backend_splitbill.auth.authentication import create_token
from fastapi.responses import JSONResponse
from backend_splitbill.auth.authentication import get_current_user
from datetime import datetime, UTC
import logging
from backend_splitbill.utils.verify_reset_token import verify_reset_token
from backend_splitbill.utils.forgot_password import forgot_password

from backend_splitbill.schemas.user_schema import (
    UserCreate as UserCreateSchema,
    UserLogin as UserLoginSchema,
    UserResponse as UserResponseSchema,
    ForgotPassword as ForgotPasswordSchema,
    VerifyOTP as VerifyOTPSchema,
    ResetPassword as ResetPasswordSchema,
    GoogleSignIn as GoogleSignInSchema,
)
from backend_splitbill.model import (
    User,
    UserIdentity,
    Invitation,
    FriendsHistory,
    GroupInvitation,
    InvitationStatus,
    GroupHistory,
    PasswordResetOTP,
)

auth_router = APIRouter(prefix="/api/auth", tags=["Auth"])
logger = logging.getLogger(__name__)
load_dotenv()
load_dotenv("backend_splitbill/.env")


def _create_session_response(user: User, *, is_new_user: bool = False) -> JSONResponse:
    token = create_token({"user_id": user.id}, expires_delta=1440)
    response = JSONResponse(
        {
            "message": f"{user.name}, you've been logged in successfully!",
            "is_new_user": is_new_user,
        }
    )
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=os.getenv("AUTH_COOKIE_SECURE", "false").strip().lower()
        in {"1", "true", "yes"},
        samesite="lax",
        max_age=60 * 60 * 24,
        path="/",
    )
    return response


# * signup
@auth_router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup_api(
    user: UserCreateSchema = Depends(UserCreateSchema.as_form),
    profilePicture: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        user.email = user.email.lower()

        # if user with same "email id" already exists
        result = await db.execute(
            select(User).where(func.lower(User.email) == user.email)
        )
        existed_user = result.scalars().one_or_none()

        if existed_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with same email already exists",
            )

        if user.mobile_number:
            result = await db.execute(
                select(User).where(User.mobile_number == user.mobile_number)
            )
            existed_user = result.scalars().one_or_none()

            if existed_user:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="User with same mobile number already exists",
                )

        user_dict = user.model_dump()

        # make email lower
        user_dict["email"] = user_dict["email"].lower()

        # store the profile picture in cloudinary and get the public id
        if profilePicture:
            if profilePicture.filename:
                profile_picture_public_id = upload_picture_on_cloudinary(
                    file=profilePicture, folder="profile_pictures"
                )
                user_dict["profile_picture"] = profile_picture_public_id

        # hash password
        user_dict["password"] = hash(user.password)

        new_user = User(**user_dict)
        db.add(new_user)

        await db.flush()

        # check pending friends invitations
        result = await db.execute(
            select(Invitation).where(
                and_(
                    or_(
                        Invitation.invitee_email == new_user.email,
                        (
                            Invitation.invitee_mobile_number == new_user.mobile_number
                            if new_user.mobile_number
                            else False
                        ),  # type: ignore
                    ),
                    Invitation.status == InvitationStatus.PENDING,
                ),
            )
        )
        existed_invitations = result.scalars().all()

        seen = set()

        # populate invitee_id with new_user's id
        for invitation in existed_invitations:
            if invitation.inviter_id in seen:
                await db.execute(
                    delete(FriendsHistory).where(
                        FriendsHistory.invitation_id == invitation.id
                    )
                )
                await db.delete(invitation)
            else:
                seen.add(invitation.inviter_id)
                invitation.invitee_id = new_user.id
                await db.execute(
                    update(FriendsHistory)
                    .where(FriendsHistory.invitation_id == invitation.id)
                    .values(receiver_id=new_user.id, guest_invitee=None)
                )

        # check pending group invitations
        result = await db.execute(
            select(GroupInvitation).where(
                or_(
                    GroupInvitation.invitee_email == new_user.email,
                    (
                        GroupInvitation.invitee_mobile_number == new_user.mobile_number
                        if new_user.mobile_number
                        else False
                    ),  # type: ignore
                ),
                GroupInvitation.status == InvitationStatus.PENDING,
            )
        )
        existed_group_invitations = result.scalars().all()

        seen = set()
        for invitation in existed_group_invitations:
            if invitation.group_id in seen:
                await db.execute(
                    delete(GroupHistory).where(
                        GroupHistory.invitation_id == invitation.id,
                    )
                )
                await db.delete(invitation)
            else:
                seen.add(invitation.group_id)
                invitation.invitee_id = new_user.id
                invitation.invitee_email = None  # type: ignore[args]
                invitation.invitee_mobile_number = None  # type: ignore[args]
                await db.execute(
                    update(GroupHistory)
                    .where(GroupHistory.invitation_id == invitation.id)
                    .values(receiver_id=new_user.id, guest_invitee=None)
                )

        await db.commit()
        await db.refresh(new_user)
    except:
        await db.rollback()
        raise

    return _create_session_response(new_user, is_new_user=True)


# * Google signup and login
@auth_router.post("/google")
async def google_signup_api(
    google_signin: GoogleSignInSchema,
    db: AsyncSession = Depends(get_db),
):
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign in is not configured on this server.",
        )

    try:
        claims = await run_in_threadpool(
            id_token.verify_oauth2_token,
            google_signin.credential,
            google_requests.Request(),
            google_client_id,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google credential.",
        )
    except GoogleAuthError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign in could not be verified right now. Please try again.",
        )

    google_sub = claims.get("sub")
    email = claims.get("email")
    if (
        not isinstance(google_sub, str)
        or not google_sub
        or not isinstance(email, str)
        or not email
        or claims.get("email_verified") is not True
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google did not provide a verified email address.",
        )

    email = email.strip().lower()
    result = await db.execute(
        select(UserIdentity).where(
            UserIdentity.provider == "google",
            UserIdentity.provider_subject == google_sub,
        )
    )
    identity = result.scalars().one_or_none()
    is_new_user = False

    if identity:
        result = await db.execute(select(User).where(User.id == identity.user_id))
        user = result.scalars().one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The SplitBill account for this Google identity was not found.",
            )
    else:
        result = await db.execute(select(User).where(func.lower(User.email) == email))
        existing_account = result.scalars().one_or_none()
        if existing_account:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is already registered without Google. Please sign in to that account before linking Google.",
            )

        mobile_number = google_signin.mobile_number
        if mobile_number:
            mobile_result = await db.execute(
                select(User).where(User.mobile_number == mobile_number)
            )
            if mobile_result.scalars().one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account already uses this mobile number.",
                )

        name = claims.get("name")
        if not isinstance(name, str) or not name.strip():
            name = email.split("@", 1)[0]
        name = name.strip()[:100]

        profile_picture = None
        google_picture_url = claims.get("picture")
        if isinstance(google_picture_url, str) and google_picture_url:
            try:
                profile_picture = await run_in_threadpool(
                    upload_google_picture_on_cloudinary,
                    google_picture_url,
                    "profile_pictures",
                )
            except Exception:
                # A profile photo is optional; a temporary image-hosting failure
                # must not block account creation.
                logger.exception("Could not import Google profile picture into Cloudinary")
                profile_picture = None

        user = User(
            name=name,
            email=email,
            password=None,
            mobile_number=mobile_number,
            profile_picture=profile_picture,
        )
        db.add(user)
        try:
            await db.flush()
        except IntegrityError as e:
            print(e)
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account already exists for this email or mobile number.",
            )
        db.add(
            UserIdentity(
                user_id=user.id,
                provider="google",
                provider_subject=google_sub,
            )
        )
        # Attach pending invitations addressed to this verified Google email.
        invitations_result = await db.execute(
            select(Invitation).where(
                Invitation.invitee_email == email,
                Invitation.status == InvitationStatus.PENDING,
            )
        )
        seen_inviters = set()
        for invitation in invitations_result.scalars().all():
            if invitation.inviter_id in seen_inviters:
                await db.execute(
                    delete(FriendsHistory).where(
                        FriendsHistory.invitation_id == invitation.id
                    )
                )
                await db.delete(invitation)
            else:
                seen_inviters.add(invitation.inviter_id)
                invitation.invitee_id = user.id
                await db.execute(
                    update(FriendsHistory)
                    .where(FriendsHistory.invitation_id == invitation.id)
                    .values(receiver_id=user.id, guest_invitee=None)
                )

        group_invitations_result = await db.execute(
            select(GroupInvitation).where(
                GroupInvitation.invitee_email == email,
                GroupInvitation.status == InvitationStatus.PENDING,
            )
        )
        seen_groups = set()
        for invitation in group_invitations_result.scalars().all():
            if invitation.group_id in seen_groups:
                await db.execute(
                    delete(GroupHistory).where(
                        GroupHistory.invitation_id == invitation.id
                    )
                )
                await db.delete(invitation)
            else:
                seen_groups.add(invitation.group_id)
                invitation.invitee_id = user.id
                invitation.invitee_email = None  # type: ignore
                invitation.invitee_mobile_number = None  # type: ignore
                await db.execute(
                    update(GroupHistory)
                    .where(GroupHistory.invitation_id == invitation.id)
                    .values(receiver_id=user.id, guest_invitee=None)
                )
        try:
            await db.commit()
            await db.refresh(user)
        except IntegrityError:
            await db.rollback()
            # A parallel callback may have created this identity after our lookup.
            raced_identity_result = await db.execute(
                select(UserIdentity).where(
                    UserIdentity.provider == "google",
                    UserIdentity.provider_subject == google_sub,
                )
            )
            raced_identity = raced_identity_result.scalars().one_or_none()
            if not raced_identity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account already exists for this email or mobile number.",
                )
            raced_user_result = await db.execute(
                select(User).where(User.id == raced_identity.user_id)
            )
            user = raced_user_result.scalars().one_or_none()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="The SplitBill account for this Google identity was not found.",
                )
        else:
            is_new_user = True

    return _create_session_response(user, is_new_user=is_new_user)


# * login
@auth_router.post("/login")
async def login_api(user: UserLoginSchema, db: AsyncSession = Depends(get_db)):
    user.email = user.email.lower()

    method = "email"
    result = await db.execute(
        select(User).where(func.lower(getattr(User, method)) == user.email)
    )
    existed_user = result.scalars().one_or_none()

    # if user doesn't exist or the password is incorrect
    if (
        not existed_user
        or not existed_user.password
        or not verify(user.password, existed_user.password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    return _create_session_response(existed_user)


# * forgot password
@auth_router.post("/forgot-password")
async def forgot_password_api(
    email: ForgotPasswordSchema, db: AsyncSession = Depends(get_db)
):
    return await forgot_password(db=db, email=email)


# * Verify OTP
@auth_router.post("/verify-otp")
async def verify_otp_api(
    verify_otp: VerifyOTPSchema, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == verify_otp.email))
    existed_user = result.scalars().one_or_none()

    if not existed_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email or OTP"
        )

    # get otp from the database where "used = False"
    result = await db.execute(
        select(PasswordResetOTP).where(
            PasswordResetOTP.user_id == existed_user.id, PasswordResetOTP.used == False
        )
    )
    existed_otp = result.scalars().one_or_none()

    # otp not exist in database
    if not existed_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password reset request found. Please request a new OTP.",
        )

    # otp is expired - 10 minutes are passed
    if existed_otp.expires_at < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new OTP.",
        )

    # otp not matched
    if not verify(verify_otp.otp, existed_otp.otp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email or OTP"
        )

    # change it to True, as OTP is used
    existed_otp.used = True

    await db.commit()

    response = JSONResponse(content={"message": "OTP verified successfully!"})

    # creating reset token
    reset_token = create_token(
        data={"user_id": existed_user.id, "purpose": "password_reset"}, expires_delta=15
    )

    # wraping the token inside cookie
    response.set_cookie(
        key="reset_token",
        value=reset_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 15,
        path="/",
    )

    return response


# * for react, whether user has reset-token or not to determine whether reset-password page should render or not
@auth_router.get("/verify-reset-token")
def verify_reset_token_cookie(reset_token: str | None = Cookie(None)):
    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Reset token not found"
        )

    return {"message": "Reset token exists"}


# * reset password
@auth_router.post("/reset-password")
async def reset_password_api(
    reset_password: ResetPasswordSchema,
    db: AsyncSession = Depends(get_db),
    reset_token: str | None = Cookie(None),
):
    payload = verify_reset_token(reset_token=reset_token)

    # get user from payload's user_id
    result = await db.execute(select(User).where(User.id == payload.get("user_id")))
    existed_user = result.scalars().one_or_none()

    if not existed_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # hash the new password
    hashed_password = hash(reset_password.new_password)

    # update current password
    existed_user.password = hashed_password
    await db.commit()

    response = JSONResponse(content={"message": "Password reset successfully!"})

    # delete reset cookie as it is no londer needed
    response.delete_cookie("reset_token", path="/")

    return response


# * resend otp
@auth_router.post("/fogot-passsword/resend")
async def resend_otp_api(
    email: ForgotPasswordSchema, db: AsyncSession = Depends(get_db)
):
    return await forgot_password(db=db, email=email)


# * logout
@auth_router.get("/logout")
def logout_api(current_user=Depends(get_current_user)):
    message = f"{current_user.name}, you've been logged out successfully!"
    response = JSONResponse({"message": message})

    # deleting cookie
    response.delete_cookie(
        key="token", httponly=True, secure=False, samesite="lax", path="/"
    )

    return response


# * get me
@auth_router.get("/me", response_model=UserResponseSchema)
def get_me_api(current_user=Depends(get_current_user)):
    return current_user
