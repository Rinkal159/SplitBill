from jose import jwt, ExpiredSignatureError, JWTError
from datetime import datetime, timedelta, UTC
from env_config import settings
from utils.raise_exception import raise_exception
from fastapi import status, Cookie, Depends
from database import get_db
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from model import User

def create_token(data: dict) -> str:
    payload = data.copy()
    expiry = datetime.now(UTC) + timedelta(settings.token_expiry_minutes)
    payload.update({"exp" : expiry})
    
    token = jwt.encode(payload, settings.token_secret_key, algorithm=settings.token_algorithm)
    return token


def verify_token(token: str):
    try:
        payload = jwt.decode(token, settings.token_secret_key, algorithms=[settings.token_algorithm])
        user_id = payload.get("user_id")
        
        if not user_id:
            raise raise_exception(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        
    except ExpiredSignatureError:
        raise raise_exception(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is expired. Please log in again.")

    except JWTError:
        raise raise_exception(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    return user_id


async def get_current_user(token: str | None = Cookie(None), db: AsyncSession = Depends(get_db)):
    if not token:
        raise raise_exception(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is expired. Please log in again.")

    user_id = verify_token(token)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().one_or_none()
    
    if not user:
        raise raise_exception(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return user
