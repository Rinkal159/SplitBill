from pydantic import BaseModel, Field, ConfigDict
from typing import Annotated, Literal
from decimal import Decimal
from datetime import date


class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# * ExpenseCreate
class PaymentSchema(Base):
    user_id: int
    amount: Annotated[Decimal, Field(ge=0)]


class ExpenseSplitSchema(Base):
    user_id: int
    amount: Annotated[Decimal | None, Field(ge=0)] = None
    percentage: Annotated[Decimal | None, Field(ge=0)] = None


class ExpenseCreate(Base):
    title: Annotated[str, Field(min_length=1, max_length=100)]
    description: Annotated[str | None, Field(min_length=10, max_length=1000)] = None
    note: Annotated[str | None, Field(min_length=10, max_length=1000)] = None

    total_amount: Annotated[Decimal, Field(gt=0)]
    expense_date: date

    participants: list[int]
    payments: list[PaymentSchema]

    split_method: Literal["equal", "amount", "percentage"]
    expense_splits: list[ExpenseSplitSchema] | None = None
    
    
class ExpenseCreateResponse(Base):
    id: int
    title: str
    description: str | None
    note: str | None
    total_amount: Decimal
    expense_date: date
    


# * ExpenseResponse
class ExpenseDetail(Base):
    id: int
    title: str
    total_amount: Decimal
    expense_date: date


class UserDetail(Base):
    id: int
    name: str
    profile_picture: str


class YourSettlementSchema(Base):
    to_user: UserDetail
    amount: Decimal


class SettlementSchema(Base):
    from_user: UserDetail
    to_user: UserDetail
    amount: Decimal


class ExpenseSchema(Base):
    expense: ExpenseDetail
    your_settlements: list[YourSettlementSchema]
    other_settlements: list[SettlementSchema]


class ExpensesResponse(Base):
    expenses: list[ExpenseSchema]


# * BorrowingsAndLendings
class Borrowings(Base):
    amount: Decimal
    borrowed_from: UserDetail


class Lendings(Base):
    amount: Decimal
    lent_to: UserDetail


class BorrowingsAndLendings(Base):
    total_borrowings: Decimal
    total_lendings: Decimal
    borrowings: list[Borrowings]
    lendings: list[Lendings]


# * FriendsSettlements
class FriendsSettlements(Base):
    expense: ExpenseDetail
    settlement: Decimal


class FriendsSettlementsResponse(Base):
    friend: UserDetail
    settlements: list[FriendsSettlements]
    total_balance: Decimal
