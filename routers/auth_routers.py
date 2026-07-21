from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, update, delete
from utils.cloudinary import upload_picture_on_cloudinary
from utils.hash_password import hash, verify
from auth.authentication import create_token
from fastapi.responses import JSONResponse
from auth.authentication import get_current_user

from schemas.user_schema import (
    UserCreate as UserCreateSchema,
    UserLogin as UserLoginSchema,
    UserResponse as UserResponseSchema
)
from model import User, Invitation, FriendsHistory

auth_router = APIRouter(prefix="/api/auth", tags=["Auth"])


# * signup
@auth_router.post("/signup", status_code=status.HTTP_201_CREATED, response_model=UserResponseSchema)
async def signup_api(
    user: UserCreateSchema = Depends(UserCreateSchema.as_form),
    profilePicture: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    user.email = user.email.lower()

    result = await db.execute(select(User).where(func.lower(User.email) == user.email))
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

    # check pending invitations
    result = await db.execute(
        select(Invitation).where(
            and_(
                or_(
                    Invitation.invitee_email == new_user.email,
                    Invitation.invitee_mobile_number == new_user.mobile_number,
                ),
                Invitation.status == "pending",
            ),
        )
    )
    existed_invitations = result.scalars().all()
    
    seen = set()

    # populate invitee_id with new_user's id
    for invitation in existed_invitations:
        if invitation.inviter_id in seen:
            await db.execute(
                delete(FriendsHistory)
                .where(FriendsHistory.invitation_id == invitation.id)
            )
            await db.delete(invitation)
            continue
        else:
            seen.add(invitation.inviter_id)
            invitation.invitee_id = new_user.id
            await db.execute(
                update(FriendsHistory)
                .where(FriendsHistory.invitation_id == invitation.id)
                .values(receiver_id = new_user.id)
            )

    await db.commit()
    await db.refresh(new_user)

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
    token = create_token({"user_id": existed_user.id})

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


# * logout
@auth_router.get("/logout")
def logout_api(current_user=Depends(get_current_user)):
    message = f"{current_user.name}, you've been logged out successfully!"
    response = JSONResponse({"message": message})

    # deleting cookie
    response.delete_cookie(key="token", httponly=True, secure=False, samesite="lax")

    return response
