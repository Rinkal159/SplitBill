from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from decimal import Decimal


class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


#* ExpenseHistory
class ExpenseDetail(Base):
    title: str
    description: str | None = None
    total_amount: Decimal
    expense_date: date


class ExpenseHistoryResponse(Base):
    action: str
    expense: ExpenseDetail
    performed_at: datetime


# * SettlementHistory
class UserDetail(Base):
    id: int
    name: str
    profile_picture: str


class SettlementHistoryResponse(Base):
    type: str
    to_user: UserDetail
    amount_settled: Decimal
    settlement_date: date
    expense: ExpenseDetail | None
