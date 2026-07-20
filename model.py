from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import (
    String,
    DateTime,
    UniqueConstraint,
    func,
    ForeignKey,
    Index,
    text,
    Numeric,
    Date,
    Enum as SQLAlchemyEnum,
)
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship
from env_config import settings
from datetime import datetime, date
import asyncio
from cloudinary.utils import cloudinary_url
from decimal import Decimal
from enum import Enum

engine = create_async_engine(settings.postgres_url)

Base = declarative_base()


class Friends(Base):
    __tablename__ = "friends"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE"), primary_key=True
    )
    friend_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # gets the user who sent the request
    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="sent_friendships",
        lazy="selectin",
    )

    # gets the user who received the request
    friend: Mapped["User"] = relationship(
        "User",
        foreign_keys=[friend_id],
        back_populates="received_friendships",
        lazy="selectin",
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password: Mapped[str] = mapped_column(String(255))
    mobile_number: Mapped[str] = mapped_column(String(10), unique=True)
    profile_picture: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # friends
    # it's not like you actually sent, but your id is smaller, that's why in user_id, your id is stored
    sent_friendships: Mapped[list["Friends"]] = relationship(
        "Friends",
        foreign_keys="Friends.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # it's not like you actually received and accepted that request, but your id is larger than other id, that's why in friend_id, your id is stored
    received_friendships: Mapped[list["Friends"]] = relationship(
        "Friends",
        foreign_keys="Friends.friend_id",
        back_populates="friend",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # invitations
    invitations: Mapped[list["Invitation"]] = relationship(
        "Invitation",
        foreign_keys="Invitation.inviter_id",
        back_populates="inviter",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # expenses created by you
    expenses: Mapped[list["Expense"]] = relationship(
        "Expense",
        foreign_keys="Expense.created_by",
        back_populates="creator",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # splits where you're the part of it
    expense_splits: Mapped[list["ExpenseSplits"]] = relationship(
        "ExpenseSplits",
        foreign_keys="ExpenseSplits.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # settlements where you're "payer"
    as_payer: Mapped[list["Settlement"]] = relationship(
        "Settlement",
        foreign_keys="Settlement.from_user",
        back_populates="payer",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    # settlements where you're "receiver"
    as_receiver: Mapped[list["Settlement"]] = relationship(
        "Settlement",
        foreign_keys="Settlement.to_user",
        back_populates="receiver",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    @property
    def profile_picture_path(self):
        if self.profile_picture:
            url, _ = cloudinary_url(self.profile_picture)
            return url
        return "/static/pictures/default.png"


class Invitation(Base):
    __tablename__ = "invitations"

    # unique constraint on inviter_id, invitee_id ans pending status
    __table_args__ = (
        Index(
            "unique_pending_invitation",
            "inviter_id",
            "invitee_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    inviter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE")
    )
    invitee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE"), nullable=True
    )
    invitee_email: Mapped[str] = mapped_column(String(255), nullable=True)
    invitee_mobile_number: Mapped[str] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    inviter: Mapped["User"] = relationship(
        "User", foreign_keys=[inviter_id], back_populates="invitations", lazy="selectin"
    )


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(1000), nullable=True)
    note: Mapped[str] = mapped_column(String(1000), nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    expense_date: Mapped[date] = mapped_column(Date)
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # who has created expense
    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="expenses",
        lazy="selectin",
    )

    # all the expense splits of this expense
    expense_splits: Mapped[list["ExpenseSplits"]] = relationship(
        "ExpenseSplits",
        foreign_keys="ExpenseSplits.expense_id",
        back_populates="expense",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    # all the settlements done for this expense - for "expensewise"
    settlements: Mapped[list["Settlement"]] = relationship(
        "Settlement",
        foreign_keys="Settlement.expense_id",
        back_populates="expense",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class ExpenseSplits(Base):
    __tablename__ = "expense_splits"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    expense_id: Mapped[int] = mapped_column(
        ForeignKey("expenses.id", onupdate="CASCADE", ondelete="CASCADE")
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE")
    )
    share_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    expense: Mapped["Expense"] = relationship(
        "Expense",
        foreign_keys=[expense_id],
        back_populates="expense_splits",
        lazy="selectin",
    )
    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="expense_splits", lazy="selectin"
    )

    # which settlement splits settling up this expense split, one expense split can appear in many settlement splits
    settlement_splits: Mapped[list["SettlementSplits"]] = relationship(
        "SettlementSplits",
        foreign_keys="SettlementSplits.split_id",
        back_populates="expense_split",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


# Settlemet and SettlementHistory
class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    expense_id: Mapped[int] = mapped_column(
        ForeignKey("expenses.id", onupdate="CASCADE", ondelete="CASCADE"), nullable=True
    )
    from_user: Mapped[int] = mapped_column(
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE")
    )
    to_user: Mapped[int] = mapped_column(
        ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE")
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    settlement_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # if user is setting up expensewise, then for which expense
    expense: Mapped["Expense"] = relationship(
        "Expense",
        foreign_keys=[expense_id],
        back_populates="settlements",
        lazy="selectin",
    )

    # payer
    payer: Mapped["User"] = relationship(
        "User", foreign_keys=[from_user], back_populates="as_payer", lazy="selectin"
    )

    # receiver
    receiver: Mapped["User"] = relationship(
        "User", foreign_keys=[to_user], back_populates="as_receiver", lazy="selectin"
    )

    # all the splits of this settlement
    settlement_splits: Mapped[list["SettlementSplits"]] = relationship(
        "SettlementSplits",
        foreign_keys="SettlementSplits.settlement_id",
        back_populates="settlement",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


# the sole reason behind creating settlement_splits table is when user's trying to settling up the overall debt, not by expensewise,
# if user settles up expensewise, then only one split of that expense which is between the user and the friend is being settling up,
# but when user settles up the debt overally then more than one expense may be settling up internally, so creating settlements_splits that stores settlement id and split id - which is being settled and the amount of that split.


class SettlementSplits(Base):
    __tablename__ = "settlement_splits"

    __table_args__ = (UniqueConstraint("settlement_id", "split_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    settlement_id: Mapped[int] = mapped_column(
        ForeignKey("settlements.id", onupdate="CASCADE", ondelete="CASCADE"), index=True
    )
    split_id: Mapped[int] = mapped_column(
        ForeignKey("expense_splits.id", onupdate="CASCADE", ondelete="CASCADE"),
        index=True,
    )
    amount_settled: Mapped[Decimal] = mapped_column(
        Numeric(10, 2)
    )  # part of that split amount
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # this split is part of which settlement
    settlement: Mapped["Settlement"] = relationship(
        "Settlement",
        foreign_keys=[settlement_id],
        back_populates="settlement_splits",
        lazy="selectin",
    )

    # for which expense split, this settlement is done
    expense_split: Mapped["ExpenseSplits"] = relationship(
        "ExpenseSplits",
        foreign_keys=[split_id],
        back_populates="settlement_splits",
        lazy="selectin",
    )


# new thing to remember - how to create enums in sqlalchemy
class HistoryAction(str, Enum):
    CREATED = "CREATED"
    UPDATED = "UPDATED"
    DELETED = "DELETED"


class ExpenseHistory(Base):
    __tablename__ = "expense_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    expense_id: Mapped[int] = mapped_column()
    
    expense_title: Mapped[str] = mapped_column(String(100))
    expense_description: Mapped[str] = mapped_column(String(1000), nullable=True)
    expense_total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    expense_expense_date: Mapped[date] = mapped_column(Date)
    
    action: Mapped[HistoryAction] = mapped_column(  # create enum
        SQLAlchemyEnum(HistoryAction)
    )
    performed_by: Mapped[int] = mapped_column()
    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# asynchronous way to create database tables
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    asyncio.run(create_tables())
