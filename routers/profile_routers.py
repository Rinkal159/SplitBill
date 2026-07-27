from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from auth.authentication import get_current_user
from services.cloudinary import delete_picture_from_cloudinary, upload_picture_on_cloudinary
from services.hash_password_otp import hash, verify

from model import UserHistory, UserHistoryAction
from schemas.profile_schema import (ProfileUpdate as ProfileUpdateSchema, ChangePassword as ChangePasswordSchema)
from schemas.user_schema import UserResponse as ProfileUpdateResponseSchema

profile_router = APIRouter(prefix="/api/users/profile", tags=["Profile"])

#* update name or profile picture
@profile_router.patch("/edit", response_model=ProfileUpdateResponseSchema)
async def edit_profile_api(
    profile: ProfileUpdateSchema = Depends(ProfileUpdateSchema.as_form),
    profilePicture: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # exclude non-updated data
    profile_dict = profile.model_dump(exclude_unset=True)
    
    # profile picture update
    if profilePicture:
        if profilePicture.filename:
            # destory exising picture
            delete_picture_from_cloudinary(current_user.profile_picture)
            
            # upload picture on cloudinary and get the public id
            profile_picture_public_id = upload_picture_on_cloudinary(profilePicture)
            profile_dict["profile_picture"] = profile_picture_public_id
            
            # history record for profile picture
            new_user_history = UserHistory(
                user_id=current_user.id,
                action=UserHistoryAction.PROFILE_PICTURE_UPDATED
            )
            db.add(new_user_history)
            
    # other fields update
    for key, val in profile_dict.items():
        setattr(current_user, key, val)
        
        # history record for name
        if key == "name":
            new_user_history = UserHistory(
                user_id=current_user.id,
                action=UserHistoryAction.NAME_UPDATED
            )
            db.add(new_user_history)
        
    await db.commit()
    await db.refresh(current_user)
    
    return current_user      


#* change password
@profile_router.patch("/password/change", response_model=ProfileUpdateResponseSchema)
async def change_password_api(
    password: ChangePasswordSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # verify current password
    is_correct = verify(password.current_password, current_user.password)
    if not is_correct:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Current password is incorrect")
    
    # check new password and confirm password are same
    if password.new_password != password.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password and confirm password do not match")
    
    # hash new password
    hashed_password = hash(password.new_password)
    
    # update password
    current_user.password = hashed_password
    
    # history record for password
    new_user_history = UserHistory(
        user_id=current_user.id,
        action=UserHistoryAction.PASSWORD_UPDATED
    )
    db.add(new_user_history)
    
    await db.commit()
    await db.refresh(current_user)
    
    return current_user      
