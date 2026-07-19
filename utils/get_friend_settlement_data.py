from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, HTTPException, status
from database import get_db
from auth.authentication import get_current_user
from sqlalchemy.orm import selectinload
from utils.get_expense_groups import get_expense_groups
from utils.get_creditors_debtors import get_creditors_debtors
from decimal import Decimal
from utils.get_settlement_groups import get_settlement_groups

from model import Friends, ExpenseSplits, User


# need to think, this is specifically for friends so both users must have friendhsip to get balances
async def get_friend_settlement_data(
    friend_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):

    result = await db.execute(select(User).where(User.id == friend_id))
    friend = result.scalars().one_or_none()

    if not friend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Friend does not exist"
        )

    your_expenses = select(ExpenseSplits.expense_id).where(
        ExpenseSplits.user_id == current_user.id
    )

    expenses_you_and_friend_involved = await db.execute(
        select(ExpenseSplits.expense_id).where(
            ExpenseSplits.user_id == friend_id,
            ExpenseSplits.expense_id.in_(your_expenses),
        )
    )

    expense_ids = expenses_you_and_friend_involved.scalars().all()

    expense_groups = await get_expense_groups(
        expense_ids=expense_ids, db=db, wantSorted=True
    )

    settlements = []
    total_balance = Decimal("0")

    for splits in expense_groups:
        settlement_groups = await get_settlement_groups(splits, db)
        expense = splits[0].expense

        creditors = []
        debtors = []
        get_creditors_debtors(splits, creditors, debtors, settlement_groups)

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

            if abs(debtor["balance"]) <= Decimal("0"):
                j += 1

        settlements.append({"expense": expense, "settlement": settlement})

    return {
        "friend": friend,
        "expense_groups": expense_groups,
        "settlements": settlements,
        "total_balance": total_balance,
    }
