from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from typing import Annotated
from backend_splitbill.database import get_db
from backend_splitbill.auth.authentication import get_current_user

from backend_splitbill.model import ExpenseHistory, Settlement, FriendsHistory
from backend_splitbill.schemas.history_schema import (
    ExpenseHistoryResponse as ExpenseHistoryResponseSchema,
    SettlementHistoryResponse as SettlementHistoryResponseSchema,
    FriendsHistory as FriendsHistoryResponseSchema,
)
from backend_splitbill.schemas.pagination_schema import PaginatedResponse

history_router = APIRouter(prefix="/api/history", tags=["History"])


# * expense history
@history_router.get("/expenses", response_model=PaginatedResponse[ExpenseHistoryResponseSchema])
async def get_expense_history_api(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    where = ExpenseHistory.performed_by == current_user.id
    total = (await db.execute(select(func.count(ExpenseHistory.id)).where(where))).scalar_one()
    result = await db.execute(
        select(ExpenseHistory)
        .where(where)
        .order_by(ExpenseHistory.performed_at.desc(), ExpenseHistory.id.desc())
        .offset((page - 1) * limit).limit(limit)
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

    return {"items": actions, "page": page, "limit": limit, "has_more": page * limit < total}


# * settlement history
@history_router.get(
    "/settlements", response_model=PaginatedResponse[SettlementHistoryResponseSchema]
)
async def get_settlement_history_api(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    where = or_(Settlement.from_user == current_user.id, Settlement.to_user == current_user.id)
    total = (await db.execute(select(func.count(Settlement.id)).where(where))).scalar_one()
    result = await db.execute(
        select(Settlement)
        .where(where)
        .order_by(Settlement.created_at.desc(), Settlement.id.desc())
        .offset((page - 1) * limit).limit(limit)
    )
    existed_settlement_history = result.scalars().all()

    settlements = []

    for settlement in existed_settlement_history:
        settlements.append(
            {
                "type": "Expensewise" if settlement.expense_id else "Overall",
                "action": (
                    "PAID" if settlement.from_user == current_user.id else "RECEIVED"
                ),
                "user": (
                    settlement.receiver
                    if settlement.from_user == current_user.id
                    else settlement.payer
                ),
                "amount_settled": settlement.amount,
                "settlement_date": settlement.settlement_date,
                "expense": settlement.expense,
            }
        )

    return {"items": settlements, "page": page, "limit": limit, "has_more": page * limit < total}


# * friends history
@history_router.get("/friends", response_model=PaginatedResponse[FriendsHistoryResponseSchema])
async def get_friends_history_api(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    where = or_(FriendsHistory.sender_id == current_user.id, FriendsHistory.receiver_id == current_user.id)
    total = (await db.execute(select(func.count(FriendsHistory.id)).where(where))).scalar_one()
    result = await db.execute(
        select(FriendsHistory)
        .where(where)
        .order_by(FriendsHistory.performed_at.desc(), FriendsHistory.id.desc())
        .offset((page - 1) * limit).limit(limit)
    )
    existed_friends_history = result.scalars().all()

    friends_history = []

    for history in existed_friends_history:

        # if you're the sender then get receiver, and if you're the receiver then get sender
        if history.sender_id == current_user.id:
            user = history.receiver if history.receiver else history.guest_invitee
        else:
            user = history.sender

        friends_history.append(
            {
                "action": history.action.value,
                "user": user,
                "performed_by_me": history.performed_by == current_user.id,
                "performed_at": history.performed_at,
            }
        )

    return {"items": friends_history, "page": page, "limit": limit, "has_more": page * limit < total}
