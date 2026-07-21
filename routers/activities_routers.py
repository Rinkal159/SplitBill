from fastapi import APIRouter, Depends, HTTPException, status
from auth.authentication import get_current_user
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, literal, union_all, or_, cast, String, case, and_

from schemas.activities_schema import ActivitiesResponse as ActivitiesResponseSchema
from model import (
    ExpenseHistory,
    Settlement,
    FriendsHistory,
    ExpenseSplits,
    User,
    FriendsHistoryAction,
)

activites_router = APIRouter(prefix="/api/activities", tags=["Activities"])


@activites_router.get("/", response_model=list[ActivitiesResponseSchema])
async def get_activities_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    expense_query = select(
        literal("EXPENSE").label("type"),
        cast(ExpenseHistory.action, String).label("action"),
        ExpenseHistory.performed_by.label("performed_by"),
        ExpenseHistory.performed_at.label("performed_at"),
        literal(None).label("amount_settled"),
    ).where(
        ExpenseHistory.expense_id.in_(
            select(ExpenseSplits.expense_id)
            .where(ExpenseSplits.user_id == current_user.id)
            .distinct()
        )
    )

    settlement_query = select(
        literal("SETTLEMENT").label("type"),
        case(
            (Settlement.from_user == current_user.id, literal("PAID")),
            else_=literal("RECEIVED"),
        ).label("action"),
        case(
            (Settlement.from_user == current_user.id, Settlement.to_user),
            else_=Settlement.from_user,
        ).label("performed_by"),
        Settlement.created_at.label("performed_at"),
        Settlement.amount.label("amount_settled"),
    ).where(
        or_(
            Settlement.from_user == current_user.id,
            Settlement.to_user == current_user.id,
        )
    )

    friends_query = select(
        literal("FRIENDS").label("type"),
        case(
            (
                and_(
                    FriendsHistory.action == FriendsHistoryAction.REQUEST_SENT,
                    FriendsHistory.receiver_id == current_user.id,
                ),
                literal("REQUEST_RECEIVED"),
            ),
            else_=cast(FriendsHistory.action, String),
        ).label("action"),
        case(
            (FriendsHistory.sender_id == current_user.id, FriendsHistory.receiver_id),
            else_=FriendsHistory.sender_id,
        ).label("performed_by"),
        FriendsHistory.performed_at.label("performed_at"),
        literal(None).label("amount_settled"),
    ).where(
        or_(
            FriendsHistory.sender_id == current_user.id,
            FriendsHistory.receiver_id == current_user.id,
        )
    )

    activities = union_all(expense_query, settlement_query, friends_query).subquery()

    result = await db.execute(
        select(activities, User)
        .join(User, User.id == activities.c.performed_by)
        .order_by(activities.c.performed_at.desc())
    )
    rows = result.mappings().all() # to get all the data from result

    activities = []
    for row in rows:
        activities.append(
            {
                "type": row["type"],
                "action": row["action"],
                "performed_by": row["User"],
                "performed_at": row["performed_at"],
                "amount_settled": row["amount_settled"],
            }
        )

    return activities
