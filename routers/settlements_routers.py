from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from auth.authentication import get_current_user
from utils.get_friend_settlement_data import get_friend_settlement_data
from decimal import Decimal
from utils.get_settlement_groups import get_settlement_groups
from sqlalchemy import select
from utils.get_expense_groups import get_expense_groups
from utils.get_settlement_creditors_debtors import get_settlement_creditors_debtors

from model import Expense, ExpenseSplits, Settlement, SettlementSplits
from schemas.settlement_schema import (
    ExpenseWiseSettlementCreate as ExpenseWiseSettlementCreateSchema,
    OverallSettlementCreate as OverallSettlementCreateSchema,
    SettlementResponse as SettlementResponseSchema,
)

settlements_router = APIRouter(prefix="/api/settlements", tags=["Settlements"])


# * settle up expense wise
@settlements_router.post("/expense", response_model=SettlementResponseSchema)
async def create_settlement_expensewise_api(
    settlement: ExpenseWiseSettlementCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # from_user and to_user are both same
    if current_user.id == settlement.to_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot settle with yourself.",
        )

    # expense doesn't exist
    result = await db.execute(
        select(Expense).where(Expense.id == settlement.expense_id)
    )
    existed_expense = result.scalars().one_or_none()

    if not existed_expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found"
        )

    # from_user and to _user doen't share that expense
    result = await db.execute(
        select(ExpenseSplits.user_id).where(
            ExpenseSplits.expense_id == settlement.expense_id,
            ExpenseSplits.user_id.in_([current_user.id, settlement.to_user]),
        )
    )
    shared_expense = result.scalars().all()

    if len(shared_expense) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot settle up if didn't share expense",
        )

    settlement_amount = settlement.amount

    expense_groups = await get_expense_groups(
        [settlement.expense_id], db=db, wantSorted=False
    )

    settlements = []

    for splits in expense_groups:
        expense = splits[0].expense

        creditors = []
        debtors = []
        await get_settlement_creditors_debtors(
            splits=splits, db=db, creditors=creditors, debtors=debtors
        )

        i = 0
        j = 0

        while i < len(creditors) and j < len(debtors):
            creditor = creditors[i]
            debtor = debtors[j]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)

            if (
                debtor["user"].id == current_user.id
                and creditor["user"].id == settlement.to_user
            ):

                # settlement amount must be less than or equals to the debt
                if settlement_amount > transfer:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="You cannot settle up beyond your debt",
                    )

                # creating new settlement
                new_settlement = Settlement(
                    expense_id=settlement.expense_id,
                    from_user=current_user.id,
                    to_user=settlement.to_user,
                    amount=settlement_amount,
                    settlement_date=settlement.settlement_date,
                )
                db.add(new_settlement)
                await db.flush()

                # creating only one settlement split for that settlement
                new_settlement_split = SettlementSplits(
                    settlement_id=new_settlement.id,
                    split_id=debtor["split_id"],
                    amount_settled=settlement_amount,
                )
                db.add(new_settlement_split)
                await db.commit()

                settlements.append(
                    {
                        "expense": expense,
                        "settled_amount": settlement_amount,
                        "remaining_debt": transfer - settlement_amount,
                    }
                )

                settlement_amount = 0
                break

            creditor["balance"] -= transfer
            debtor["balance"] += transfer

            if creditor["balance"] <= 0:
                i += 1

            if abs(debtor["balance"]) <= 0:
                j += 1

        if settlement_amount == 0:
            break

    return {"message": "Settled successfully!", "settled_splits": settlements}


# * settle up overally with a friend
@settlements_router.post("/overall", response_model=SettlementResponseSchema)
async def create_settlement_overall_api(
    settlement: OverallSettlementCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if settlement.to_user == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot settle up with yourself",
        )

    friend_settlement_data = await get_friend_settlement_data(
        friend_id=settlement.to_user, db=db, current_user=current_user
    )

    if friend_settlement_data["total_balance"] < 0:
        if settlement.amount > abs(friend_settlement_data["total_balance"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Settlement amount cannot be greater than total debt",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot settle up if you do not have borrowings",
        )

    settlement_amount = settlement.amount

    new_settlement = Settlement(
        from_user=current_user.id,
        to_user=settlement.to_user,
        amount=settlement_amount,
        settlement_date=settlement.settlement_date,
    )

    db.add(new_settlement)
    await db.flush()

    settlements = []

    for splits in friend_settlement_data["expense_groups"]:
        expense = splits[0].expense

        creditors = []
        debtors = []
        await get_settlement_creditors_debtors(
            splits=splits, db=db, creditors=creditors, debtors=debtors
        )

        i = 0
        j = 0

        while i < len(creditors) and j < len(debtors) and settlement_amount > 0:
            creditor = creditors[i]
            debtor = debtors[j]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)
            amount_to_transfer = transfer

            if (
                debtor["user"].id == current_user.id
                and creditor["user"].id == settlement.to_user
            ):
                amount_to_transfer = min(settlement_amount, transfer)

                new_settlement_split = SettlementSplits(
                    settlement_id=new_settlement.id,
                    split_id=debtor["split_id"],
                    amount_settled=amount_to_transfer,
                )
                db.add(new_settlement_split)

                settlement_amount -= amount_to_transfer

                remaining_debt = (
                    friend_settlement_data["total_balance"] + amount_to_transfer
                )
                settlements.append(
                    {
                        "expense": expense,
                        "settled_amount": amount_to_transfer,
                        "remaining_debt": (
                            0 if remaining_debt > 0 else abs(remaining_debt)
                        ),
                    }
                )

            creditor["balance"] -= amount_to_transfer
            debtor["balance"] += amount_to_transfer

            if creditor["balance"] <= 0:
                i += 1

            if abs(debtor["balance"]) <= 0:
                j += 1

        if settlement_amount <= 0:
            break

    await db.commit()

    return {"message": "Settled successfully!", "settled_splits": settlements}
