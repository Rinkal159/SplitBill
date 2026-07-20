from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from auth.authentication import get_current_user

from model import ExpenseHistory, Settlement
from schemas.history_schema import (
    ExpenseHistoryResponse as ExpenseHistoryResponseSchema,
    SettlementHistoryResponse as SettlementHistoryResponseSchema,
)

history_router = APIRouter(prefix="/api/history", tags=["History"])


# expense history
@history_router.get("/expenses", response_model=list[ExpenseHistoryResponseSchema])
async def get_expense_history_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(ExpenseHistory)
        .where(ExpenseHistory.performed_by == current_user.id)
        .order_by(ExpenseHistory.performed_at.desc())
    )
    existed_expense_history = result.scalars().all()

    actions = []
    for history in existed_expense_history:
        actions.append(
            {
                "action": f"{history.action.value} {history.expense_title}",
                "expense": {
                    "title": history.expense_title,
                    "description": history.expense_description,
                    "total_amount": history.expense_total_amount,
                    "expense_date": history.expense_expense_date,
                },
                "performed_at": history.performed_at,
            }
        )

    return actions


# settlement history
@history_router.get("/settlements", response_model=list[SettlementHistoryResponseSchema])
async def get_settlement_history_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(Settlement)
        .where(Settlement.from_user == current_user.id)
        .order_by(Settlement.created_at.desc())
    )
    existed_settlement_history = result.scalars().all()

    settlements = []

    for settlement in existed_settlement_history:
        settlements.append(
            {
                "type": "Expensewise" if settlement.expense_id else "Overall",
                "to_user": settlement.receiver,
                "amount_settled": settlement.amount,
                "settlement_date": settlement.settlement_date,
                "expense": settlement.expense,
            }
        )

    return settlements
