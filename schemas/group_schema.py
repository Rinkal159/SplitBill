from pydantic import BaseModel, Field, ConfigDict, EmailStr, model_validator
from typing import Annotated
from model import GroupInvitationStatus, GroupMemberRole
from enum import Enum
from datetime import datetime, date
from decimal import Decimal


class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# * GroupCreate
class GroupInvitationSchema(Base):
    email: EmailStr | None = None
    mobile_number: Annotated[str | None, Field(pattern=r"^\d{10}$")] = None

    @model_validator(mode="after")
    def validate_invitation_method(self):
        if not self.email and not self.mobile_number:
            raise ValueError("Either email or mobile number is required")

        if self.email and self.mobile_number:
            raise ValueError("Provide either email or mobile number, not both")

        return self


class GroupCreate(Base):
    name: Annotated[str, Field(min_length=4, max_length=100)]
    description: Annotated[str | None, Field(min_length=10, max_length=1000)] = None
    invitations: list[GroupInvitationSchema]


# * InviatationResponse
class UserDetail(Base):
    id: int
    name: str
    profile_picture: str


class GroupDetail(Base):
    id: int
    name: str
    description: str | None
    creator: UserDetail


class InvitationResponse(Base):
    id: int
    status: GroupInvitationStatus
    group: GroupDetail
    inviter: UserDetail


# * InvitationUpdate
class InvitationUpdateStatus(str, Enum):
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class InvitationUpdate(Base):
    status: InvitationUpdateStatus


# * GroupResponse
class GroupMembers(Base):
    user: UserDetail
    role: GroupMemberRole


class GroupDetailWithMembers(GroupDetail):
    members: list[GroupMembers]


class GroupResponse(Base):
    group: GroupDetailWithMembers
    role: GroupMemberRole
    joined_at: datetime


#* ExpenseWithSpecificMemberResponse
class ExpenseDetail(Base):
    id: int
    group: GroupDetail
    title: str
    total_amount: Decimal
    expense_date: date
    
class SettlementsWithMember(Base):
    expense: ExpenseDetail
    settlement: Decimal
    
    
class ExpenseWithSpecificMemberResponse(Base):
    member: UserDetail
    settlements: list[SettlementsWithMember]
    total_balance: Decimal