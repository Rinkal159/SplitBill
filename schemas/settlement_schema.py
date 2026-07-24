from pydantic import BaseModel, Field, ConfigDict
from typing import Annotated
from decimal import Decimal
from datetime import date


class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


#* SettlementCreate
class SettlementBase(Base):
    to_user: int
    amount: Annotated[Decimal, Field(gt=0)]
    payment_method: Annotated[str, Field(
        max_length=30
    )]
    note: Annotated[str, Field(
        max_length=1500
    )]
    settlement_date: date


class ExpenseWiseSettlementCreate(SettlementBase):
    expense_id: int


class OverallSettlementCreate(SettlementBase):
    pass


class OverallSettlementGroupwiseCreate(SettlementBase):
    group_id: int


#* SettlementResponse
class ExpenseDetail(Base):
    id: int
    title: str
    total_amount: Decimal
    expense_date: date


class SettlementDetail(Base):
    expense: ExpenseDetail
    settled_amount: Decimal
    remaining_debt: Decimal


class SettlementResponse(Base):
    message: str
    settled_splits: list[SettlementDetail]
