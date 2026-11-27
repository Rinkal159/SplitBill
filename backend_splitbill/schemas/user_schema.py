from pydantic import BaseModel, Field, EmailStr, ConfigDict, ValidationError
from typing import Annotated
from fastapi import Form
from datetime import datetime
from fastapi.exceptions import RequestValidationError


class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# * UserCreate
class UserCreate(Base):
    name: Annotated[str, Field(min_length=4, max_length=100)]
    email: EmailStr
    password: Annotated[str, Field(min_length=8)]
    mobile_number: Annotated[
        str | None, Field(min_length=10, max_length=10, pattern=r"^\d{10}$")
    ] = None

    @classmethod
    def as_form(
        cls,
        name: str = Form(...),
        email: str = Form(...),
        password: str = Form(...),
        mobile_number: str | None = Form(None),
    ):
        try:
            return cls(
                name=name,
                email=email,
                password=password,
                mobile_number=mobile_number or None,
            )
        except ValidationError as e:
            raise RequestValidationError(e.errors())


# * UserResponse
class UserResponse(Base):
    id: int
    name: str
    email: EmailStr
    mobile_number: str | None = None
    profile_picture_path: str
    created_at: datetime
    updated_at: datetime


# * UserLogin
class UserLogin(Base):
    email: EmailStr
    password: str


class GoogleSignIn(BaseModel):
    credential: Annotated[str, Field(min_length=20)]
    mobile_number: Annotated[
        str | None, Field(min_length=10, max_length=10, pattern=r"^\d{10}$")
    ] = None


# * ForgotPassword
class ForgotPassword(Base):
    email: EmailStr


# * VerifyOTP
class VerifyOTP(Base):
    email: EmailStr
    otp: Annotated[str, Field(min_length=6, max_length=6, pattern=r"^\d{6}$")]


# * ResetPassword
class ResetPassword(Base):
    new_password: Annotated[str, Field(min_length=8)]
