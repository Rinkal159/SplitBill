from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Cookie
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, update, delete
from services.cloudinary import upload_picture_on_cloudinary
from services.hash_password_otp import hash, verify
from auth.authentication import create_token
from fastapi.responses import JSONResponse
from auth.authentication import get_current_user
from datetime import datetime, UTC
from auth.authentication import verify_token
from utils.forgot_password import forgot_password

from schemas.user_schema import (
    UserCreate as UserCreateSchema,
    UserLogin as UserLoginSchema,
    UserResponse as UserResponseSchema,
    ForgotPassword as ForgotPasswordSchema,
    VerifyOTP as VerifyOTPSchema,
    ResetPassword as ResetPasswordSchema,
)
from model import (
    User,
    Invitation,
    FriendsHistory,
    GroupInvitation,
    InvitationStatus,
    GroupHistory,
    PasswordResetOTP,
)

auth_router = APIRouter(prefix="/api/auth", tags=["Auth"])


# * signup
@auth_router.post(
    "/signup", status_code=status.HTTP_201_CREATED, response_model=UserResponseSchema
)
async def signup_api(
    user: UserCreateSchema = Depends(UserCreateSchema.as_form),
    profilePicture: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        user.email = user.email.lower()

        result = await db.execute(
            select(User).where(func.lower(User.email) == user.email)
        )
        existed_user = result.scalars().one_or_none()

        # if user with same "email id" already exists
        if existed_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with same email already exists",
            )

        result = await db.execute(
            select(User).where(User.mobile_number == user.mobile_number)
        )
        existed_user = result.scalars().one_or_none()

        # if user with same "mobile number" already exists
        if existed_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with same mobile number already exists",
            )

        user_dict = user.model_dump()

        # store the profile picture in cloudinary and get the public id
        if profilePicture:
            if profilePicture.filename:
                profile_picture_public_id = upload_picture_on_cloudinary(profilePicture)
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
                        Invitation.invitee_mobile_number == new_user.mobile_number,
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
                    GroupInvitation.invitee_mobile_number == new_user.mobile_number,
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

    return new_user


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
    if not existed_user or not verify(user.password, existed_user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    # creating a token
    token = create_token(
        {"user_id": existed_user.id}, expires_delta=1440
    )  # token will expire in 1440 mins == one day

    message = f"{existed_user.name}, you've been logged in successfully!"
    response = JSONResponse({"message": message})

    # wrapping token inside a cookie
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )

    # sending response
    return response


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
        return {
            "message": "If the provided email and OTP are valid, the verification will be processed."
        }

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
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid OTP")

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
    )

    return response


# * reset password
@auth_router.post("/reset-password")
async def reset_password_api(
    reset_password: ResetPasswordSchema,
    db: AsyncSession = Depends(get_db),
    reset_token: str | None = Cookie(None),
):
    # if not got the reset_token then OTP was not verified at first place
    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify through OTP before reseting password",
        )

    # get the payload
    payload = verify_token(reset_token)

    # if not the reset_token payload then it is invalid
    if payload.get("purpose") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid reset token"
        )

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
    response.delete_cookie("reset_token")

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
    response.delete_cookie(key="token", httponly=True, secure=False, samesite="lax")

    return response


# * get me
@auth_router.get("/me", response_model=UserResponseSchema)
def get_me_api(current_user=Depends(get_current_user)):
    return current_user
