from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, HTTPException, status
from database import get_db
from auth.authentication import get_current_user
from sqlalchemy.orm import selectinload
from utils.get_expense_groups import generate_expense_groups
from utils.get_creditors_debtors import get_creditors_debtors
from decimal import Decimal

from model import Friends, ExpenseSplits

async def get_friend_settlement_data(
    friend_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):

    # friend_id is not your friend
    result = await db.execute(
        select(Friends)
        .options(selectinload(Friends.friend), selectinload(Friends.user))
        .where(
            or_(
                and_(
                    Friends.user_id == current_user.id, Friends.friend_id == friend_id
                ),
                and_(
                    Friends.user_id == friend_id, Friends.friend_id == current_user.id
                ),
            )
        )
    )
    existed_friendship = result.scalars().one_or_none()
    if not existed_friendship:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot fetch expenses with non-friend",
        )

    friend = (
        existed_friendship.friend
        if existed_friendship.user.id == current_user.id
        else existed_friendship.user
    )

    your_expenses = select(ExpenseSplits.expense_id).where(ExpenseSplits.user_id == current_user.id)

    expenses_you_and_friend_involved = await db.execute(
        select(ExpenseSplits.expense_id).where(
            ExpenseSplits.user_id == friend_id, ExpenseSplits.expense_id.in_(your_expenses)
        )
    )

    expense_ids = expenses_you_and_friend_involved.scalars().all()

    expense_groups = await generate_expense_groups(expense_ids=expense_ids, db=db, wantSorted=True)

    settlements = []
    total_balance = Decimal("0")

    for splits in expense_groups:
        expense = splits[0].expense

        creditors = []
        debtors = []
        get_creditors_debtors(splits, creditors, debtors)

        i = 0  # creditor
        j = 0  # debtor

        settlement = Decimal("0")

        while i < len(creditors) and j < len(debtors):
            creditor = creditors[i]
            debtor = debtors[j]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)

            # you "lent" to friend
            if (
                creditor["user"].id == current_user.id
                and debtor["user"].id == friend_id
            ):
                settlement += transfer
                total_balance += transfer

            # you "borrowed" from friend
            elif (
                debtor["user"].id == current_user.id
                and creditor["user"].id == friend_id
            ):
                settlement += -transfer
                total_balance -= transfer

            creditor["balance"] -= transfer
            debtor["balance"] += transfer

            if creditor["balance"] <= Decimal("0"):
                i += 1

            if debtor["balance"] <= Decimal("0"):
                j += 1

        settlements.append({"expense": expense, "settlement": settlement})

    return {
        "friend": friend,
        "expense_groups": expense_groups,
        "settlements": settlements,
        "total_balance": total_balance,
    }
