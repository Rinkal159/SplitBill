import cloudinary
import cloudinary.uploader
from env_config import settings

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