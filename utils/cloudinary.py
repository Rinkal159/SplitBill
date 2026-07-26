import cloudinary
from env_config import settings
import cloudinary.uploader
from fastapi import HTTPException, status

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True
)

def upload_picture_on_cloudinary(file):
    result = cloudinary.uploader.upload(
        file.file,                
        folder="profile_pictures",
        resource_type="image"
    )

    return result["public_id"]


def delete_picture_from_cloudinary(public_id):
    result = cloudinary.uploader.destroy(public_id=public_id)
    if result.get("result") != "ok":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Failed to destory image")
