from pydantic import BaseModel, Field, ConfigDict
from typing import Annotated, Literal
from decimal import Decimal
from datetime import date, datetime
from backend_splitbill.model import SettlementStatus


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
    group_id: int | None = None

    title: Annotated[str, Field(min_length=1, max_length=100)]
    description: Annotated[str | None, Field(min_length=10, max_length=1000)] = None
    note: Annotated[str | None, Field(min_length=10, max_length=1000)] = None

    total_amount: Annotated[Decimal, Field(gt=0)]
    expense_date: date

    participants: list[int]
    payments: list[PaymentSchema]

    split_method: Literal["equal", "amount", "percentage"]
    expense_splits: list[ExpenseSplitSchema] | None = None


# * ExpenseCreateResponse
class UserDetail(Base):
    id: int
    name: str
    profile_picture_path: str


class GroupDetail(Base):
    name: str
    description: str | None
    creator: UserDetail


class ExpenseCreateResponse(Base):
    id: int
    group: GroupDetail | None
    title: str
    description: str | None
    attachment_url: str | None
    note: str | None
    total_amount: Decimal
    expense_date: date
    created_at: datetime


# * ExpenseResponse
class ExpenseDetail(Base):
    id: int
    group: GroupDetail | None
    title: str
    total_amount: Decimal
    expense_date: date
    created_at: datetime
    created_by: int
    creator: UserDetail
    split_method: str | None = None


class YourSettlementSchema(Base):
    to_user: UserDetail
    amount: Decimal


class SettlementSchema(Base):
    from_user: UserDetail
    to_user: UserDetail
    amount: Decimal


class ExpenseParticipantSplitSchema(Base):
    user: UserDetail
    share_amount: Decimal
    paid_amount: Decimal
    split_value: Decimal | None = None


class ExpenseSettlementHistorySchema(Base):
    id: int
    direction: Literal["PAID", "RECEIVED"]
    counterparty: UserDetail
    amount: Decimal
    total_amount: Decimal
    payment_method: str
    settlement_date: date
    status: SettlementStatus
    note: str | None = None


class ExpenseSchema(Base):
    expense: ExpenseDetail
    expense_splits: list[ExpenseParticipantSplitSchema]
    settlement_history: list[ExpenseSettlementHistorySchema]
    your_settlements: list[YourSettlementSchema]
    your_actual_settlements: list[YourSettlementSchema]
    others_actual_settlements: list[SettlementSchema]
    your_balance: Decimal


class PaginatedExpensesResponse(Base):
    expenses: list[ExpenseSchema]
    friend_balances: dict
    total_balance: Decimal
    page: int
    skip: int
    limit: int
    has_more: bool


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
class FriendExpenseSchema(Base):
    expense: ExpenseDetail
    expense_splits: list[ExpenseParticipantSplitSchema]
    settlement_history: list[ExpenseSettlementHistorySchema]
    your_settlements: list[YourSettlementSchema]
    your_actual_settlements: list[YourSettlementSchema]
    others_actual_settlements: list[SettlementSchema]
    your_expensewise_balance_with_friend: Decimal


class FriendsSettlementsResponse(Base):
    friend: UserDetail
    settlements: list[FriendExpenseSchema]
    friend_balances: dict
    total_balance: Decimal
    group_balance: Decimal
    individual_balance: Decimal
    page: int | None = None
    skip: int | None = None
    limit: int | None = None
    has_more: bool | None = None


# * TotalBalanceWithFriend
class TotalBalanceWithFriend(Base):
    friend: UserDetail
    total_balance: Decimal
    had_expenses: bool
