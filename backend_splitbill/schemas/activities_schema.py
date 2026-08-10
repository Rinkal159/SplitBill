from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from decimal import Decimal


class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


#* PaginatedActivitiesResponse
class UserDetail(Base):
    id: int
    name: str
    profile_picture: str


class GroupDetail(Base):
    name: str
    
    
class ActivitiesResponse(Base):
    type: str
    group_name: GroupDetail | None
    action: str
    performed_by: UserDetail
    affected_user: UserDetail | None
    affected_guest: str | None
    performed_by_me: bool
    performed_at: datetime
    amount_settled: Decimal | None


class PaginatedActivitiesResponse(Base):
    activities: list[ActivitiesResponse]
    page: int
    skip: int
    limit: int
    has_more: bool
