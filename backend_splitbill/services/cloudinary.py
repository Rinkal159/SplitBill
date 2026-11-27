from urllib.parse import urlparse

import cloudinary
from backend_splitbill.env_config import settings
import cloudinary.uploader
from fastapi import HTTPException, status

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True
)

def upload_picture_on_cloudinary(file, folder):
    result = cloudinary.uploader.upload(
        file.file,                
        folder=folder,
        resource_type="image"
    )

    return result["public_id"]


def upload_google_picture_on_cloudinary(picture_url: str, folder: str):
    parsed_url = urlparse(picture_url)
    hostname = (parsed_url.hostname or "").lower()
    if (
        parsed_url.scheme != "https"
        or not (
            hostname == "googleusercontent.com"
            or hostname.endswith(".googleusercontent.com")
        )
    ):
        raise ValueError("Google returned an unsupported profile picture URL")

    return upload_picture_on_cloudinary(picture_url, folder)


def delete_picture_from_cloudinary(public_id):
    result = cloudinary.uploader.destroy(public_id=public_id)
    if result.get("result") != "ok":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Failed to destory image")
