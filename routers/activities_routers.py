from fastapi import APIRouter, Depends, Query
from auth.authentication import get_current_user
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import (
    select,
    literal,
    union_all,
    or_,
    cast,
    String,
    case,
    and_,
    func,
    union,
)
from typing import Annotated
from sqlalchemy.orm import aliased

from schemas.activities_schema import (
    PaginatedActivitiesResponse as PaginatedActivitiesResponseSchema,
)
from model import (
    ExpenseHistory,
    Settlement,
    FriendsHistory,
    ExpenseSplits,
    User,
    Group,
    GroupHistory,
    GroupHistoryAction,
    GroupMember,
    FriendsHistoryAction,
    UserHistory,
)

activites_router = APIRouter(prefix="/api/activities", tags=["Activities"])


# * get activities - paginated
@activites_router.get("/", response_model=PaginatedActivitiesResponseSchema)
async def get_activities_api(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    page: int = 1,
    limit: Annotated[int, Query(gt=0, lt=100)] = 10,
):
    # type
    # group_id
    # action

    # performed_by
    # affected_user
    # affected_guest

    # performed_by_me
    # performed_at
    # amount_settled

    expense_query = select(
        case(
            (ExpenseHistory.group_id == None, literal("EXPENSE")),
            else_=literal("GROUP_EXPENSE"),
        ).label("type"),
        ExpenseHistory.group_id.label("group_id"),
        cast(ExpenseHistory.action, String).label("action"),
        ExpenseHistory.performed_by.label("performed_by"),
        literal(None).label("affected_user"),
        literal(None).label("affected_guest"),
        case(
            (ExpenseHistory.performed_by == current_user.id, literal(True)),
            else_=literal(False),
        ).label("performed_by_me"),
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
        case(
            (Settlement.expense_id != None, literal("EXPENSEWISE SETTLEMENT")),
            (Settlement.group_id != None, literal("GROUPWISE SETTLEMENT")),
            else_=literal("OVERALL SETTLEMENT"),
        ).label("type"),
        Settlement.group_id.label("group_id"),
        case(
            (Settlement.from_user == current_user.id, literal("PAID")),
            else_=literal("RECEIVED"),
        ).label("action"),
        Settlement.from_user.label("performed_by"),
        Settlement.to_user.label("affected_user"),
        literal(None).label("affected_guest"),
        case(
            (Settlement.from_user == current_user.id, literal(True)),
            else_=literal(False),
        ).label("performed_by_me"),
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
        literal(None).label("group_id"),
        cast(FriendsHistory.action, String).label("action"),
        FriendsHistory.performed_by.label("performed_by"),
        case(
            (
                or_(
                    FriendsHistory.action == FriendsHistoryAction.REQUEST_SENT,
                    FriendsHistory.action == FriendsHistoryAction.FRIEND_REMOVED,
                    FriendsHistory.action == FriendsHistoryAction.REQUEST_CANCELLED
                ),
                FriendsHistory.receiver_id,
            ),
            (
                FriendsHistory.action == FriendsHistoryAction.REQUEST_ACCEPTED,
                FriendsHistory.sender_id,
            ),
        ).label("affected_user"),
        case(
            (FriendsHistory.guest_invitee.is_not(None), FriendsHistory.guest_invitee),
            else_=literal(None),
        ).label("affected_guest"),
        case(
            (FriendsHistory.performed_by == current_user.id, literal(True)),
            else_=literal(False),
        ).label("performed_by_me"),
        FriendsHistory.performed_at.label("performed_at"),
        literal(None).label("amount_settled"),
    ).where(
        or_(
            FriendsHistory.sender_id == current_user.id,
            FriendsHistory.receiver_id == current_user.id,
        )
    )

    group_query = select(
        literal("GROUP").label("type"),
        GroupHistory.group_id.label("group_id"),
        cast(GroupHistory.action, String).label("action"),
        GroupHistory.performed_by.label("performed_by"),
        case(
            (GroupHistory.action == GroupHistoryAction.GROUP_CREATED, literal(None)),
            (
                GroupHistory.action == GroupHistoryAction.GROUP_INVITATION_SENT,
                GroupHistory.receiver_id,
            ),
            (
                GroupHistory.action == GroupHistoryAction.GROUP_INVITATION_ACCEPTED,
                GroupHistory.sender_id,
            ),
        ).label("affected_user"),
        case(
            (GroupHistory.guest_invitee.is_not(None), GroupHistory.guest_invitee),
            else_=literal(None),
        ).label("affected_guest"),
        case(
            (GroupHistory.performed_by == current_user.id, literal(True)),
            else_=literal(False),
        ).label("performed_by_me"),
        GroupHistory.performed_at.label("performed_at"),
        literal(None).label("amount_settled"),
    ).where(
        or_(
            # User is already a member
            GroupHistory.group_id.in_(
                select(GroupMember.group_id).where(
                    GroupMember.user_id == current_user.id
                )
            ),
            # User is NOT a member but was invited
            and_(
                GroupHistory.action == GroupHistoryAction.GROUP_INVITATION_SENT,
                GroupHistory.receiver_id == current_user.id,
            ),
        )
    )

    user_query = select(
        literal("USER").label("type"),
        literal(None).label("group_id"),
        cast(UserHistory.action, String).label("action"),
        UserHistory.user_id.label("performed_by"),
        literal(None).label("affected_user"),
        literal(None).label("affected_guest"),
        literal(True).label("performed_by_me"),
        UserHistory.performed_at.label("performed_at"),
        literal(None).label("amount_settled"),
    )

    activities = union_all(
        expense_query, settlement_query, friends_query, group_query, user_query
    ).subquery()

    result = await db.execute(select(func.count()).select_from(activities))
    total_activities = result.scalar_one()

    PerformedBy = aliased(User, name="performed_by_user")
    AffectedUser = aliased(User, name="affected_user_obj")

    skip = limit * (page - 1)
    result = await db.execute(
        select(activities, PerformedBy, AffectedUser, Group)
        .outerjoin(PerformedBy, PerformedBy.id == activities.c.performed_by)
        .outerjoin(AffectedUser, AffectedUser.id == activities.c.affected_user)
        .outerjoin(Group, Group.id == activities.c.group_id)
        .order_by(activities.c.performed_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = result.mappings().all()  # to get all the data from result

    activities = []
    for row in rows:
        activities.append(
            {
                "type": row["type"],
                "group_name": row["Group"],
                "action": row["action"],
                "performed_by": row["performed_by_user"],
                "affected_user": row["affected_user_obj"],
                "affected_guest": row["affected_guest"],
                "performed_by_me": row["performed_by_me"],
                "performed_at": row["performed_at"],
                "amount_settled": row["amount_settled"],
            }
        )

    return PaginatedActivitiesResponseSchema(
        activities=activities,
        page=page,
        skip=skip,
        limit=limit,
        has_more=skip + len(activities) < total_activities,
    )
