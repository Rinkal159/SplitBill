from pydantic import BaseModel, Field, EmailStr, model_validator, ConfigDict
from typing import Annotated
from enum import Enum


class Base(BaseModel):
    pass


class InvitationCreate(Base):
    email: EmailStr | None = None
    mobile_number: Annotated[str | None, Field(pattern=r"^\d{10}$")] = None

    @model_validator(mode="after")
    def validate_invite_method(self):
        if not self.email and not self.mobile_number:
            raise ValueError("Either email or mobile number is required.")

        if self.email and self.mobile_number:
            raise ValueError("Provide either email or mobile number, not both.")

        return self


class InvitationStatus(str, Enum):
    accepted = "accepted"
    rejected = "rejected"


class InvitationUpdate(Base):
    status: InvitationStatus


class UserDetail(Base):
    id: int
    name: str
    email: str
    mobile_number: str
    profile_picture_path: str

    model_config = ConfigDict(from_attributes=True)


class InvitationsResponse(Base):
    id: int
    status: str
    inviter: UserDetail

    model_config = ConfigDict(from_attributes=True)
