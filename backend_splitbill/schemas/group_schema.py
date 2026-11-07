from pydantic import BaseModel, Field, ConfigDict, EmailStr, model_validator
from typing import Annotated
from backend_splitbill.model import InvitationStatus, GroupMemberRole
from enum import Enum
from datetime import datetime, date
from decimal import Decimal
from fastapi import Form


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


# * GroupUpdate
class GroupUpdate(Base):
    name: Annotated[str | None, Field(min_length=4, max_length=100)] = None
    description: Annotated[str | None, Field(min_length=10, max_length=1000)] = None

    @classmethod
    def as_form(
        cls,
        name: str | None = Form(default=None),
        description: str | None = Form(default=None),
    ):
        return cls(name=name, description=description)


# * AdditionalInvitations
class AdditionalInvitations(Base):
    invitations: list[GroupInvitationSchema]


# * InviatationResponse
class UserDetail(Base):
    id: int
    name: str
    email: EmailStr
    profile_picture_path: str


class GroupDetail(Base):
    id: int
    name: str
    description: str | None
    group_picture_path: str
    creator: UserDetail


# * GroupDebt
class GroupDebt(Base):
    group: GroupDetail
    debt_amount: Decimal


class InvitationResponse(Base):
    id: int
    group: GroupDetail
    updated_at: datetime


class ReceivedInvitationResponse(InvitationResponse):
    inviter: UserDetail


class SentInvitationRespose(InvitationResponse):
    invitee: UserDetail | None
    invitee_email: EmailStr | None
    invitee_mobile_number: str | None


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
    id: int
    members: list[GroupMembers]


class GroupResponse(Base):
    group: GroupDetailWithMembers


# * GroupNameResponse
class GroupNameResponse(Base):
    group: GroupDetail


# * SingleGroupResponse
class SingleGroupResponse(Base):
    group: GroupDetailWithMembers
    total_members: int


# * ExpenseWithSpecificMemberResponse
class ExpenseDetail(Base):
    id: int
    group: GroupDetail
    title: str
    total_amount: Decimal
    expense_date: date


class SettlementsWithMember(Base):
    expense: ExpenseDetail
    net_balance: Decimal


class ExpenseWithSpecificMemberResponse(Base):
    member: UserDetail
    settlements: list[SettlementsWithMember]
    total_balance: Decimal


# * GroupsSentInvitations
class InviteeDetails(Base):
    invitee: UserDetail | None
    invitee_email: EmailStr | None
    invitee_mobile_number: str | None


class GroupsSentInvitations(Base):
    invitees: list[InviteeDetails]
