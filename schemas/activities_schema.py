from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from decimal import Decimal


class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserDetail(Base):
    id: int
    name: str
    profile_picture: str


class ActivitiesResponse(Base):
    type: str
    action: str
    user: UserDetail
    performed_by_me: bool
    performed_at: datetime
    amount_settled: Decimal | None


class PaginatedActivitiesResponse(Base):
    activities: list[ActivitiesResponse]
    page: int
    skip: int
    limit: int
    has_more: bool
