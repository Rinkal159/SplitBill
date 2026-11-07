from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from backend_splitbill.model import SettlementStatus


class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SettlementCreate(Base):
    to_user: Annotated[int, Field(gt=0)]
    amount: Annotated[Decimal, Field(gt=0, max_digits=10, decimal_places=2)]
    payment_method: Annotated[str, Field(max_length=30)] = "CASH"
    note: Annotated[str | None, Field(max_length=1500)] = None
    settlement_date: date
    expense_id: Annotated[int | None, Field(gt=0)] = None
    group_id: Annotated[int | None, Field(gt=0)] = None


class SettlementUser(Base):
    id: int
    name: str
    email: str
    profile_picture_path: str


class SettlementRequestResponse(Base):
    id: int
    from_user: int
    to_user: int
    payer: SettlementUser
    receiver: SettlementUser
    amount: Decimal
    payment_method: str
    note: str | None
    settlement_date: date
    expense_id: int | None
    group_id: int | None
    status: SettlementStatus
    created_at: datetime
    responded_at: datetime | None


class ExpenseDetail(Base):
    id: int
    title: str
    total_amount: Decimal
    expense_date: date


class SettlementDetail(Base):
    expense: ExpenseDetail
    settled_amount: Decimal
    remaining_debt_for_this_expense: Decimal


class SettlementSplitResponse(Base):
    id: int
    split_id: int
    amount_settled: Decimal


class SettlementResponse(Base):
    message: str
    status: SettlementStatus
    settled_splits: list[SettlementDetail]
    settlement_splits: list[SettlementSplitResponse]
