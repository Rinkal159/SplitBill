from pydantic import BaseModel, Field
from typing import Annotated, Literal
from decimal import Decimal
from datetime import date


class Base(BaseModel):
    pass


class PaymentSchema(Base):
    user_id: int
    amount: Decimal


class SplitSchema(Base):
    user_id: int
    amount: Decimal | None = None
    percentage: Decimal | None = None


class ExpenseCreate(Base):
    title: Annotated[str, Field(min_length=1, max_length=100)]
    description: Annotated[str | None, Field(min_length=10, max_length=1000)] = None
    note: Annotated[str | None, Field(min_length=10, max_length=1000)] = None

    total_amount: Decimal
    expense_date: date

    participants: list[int]
    payments: list[PaymentSchema]

    split_method: Literal["equal", "amount", "percentage"]
    splits: list[SplitSchema] | None = None
