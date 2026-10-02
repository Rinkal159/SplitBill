from fastapi import APIRouter, Depends, Query
from backend_splitbill.auth.authentication import get_current_user
from backend_splitbill.database import get_db
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
    Integer,
    Numeric,
)
from typing import Annotated, Literal
from sqlalchemy.orm import aliased

from backend_splitbill.schemas.activities_schema import (
    PaginatedActivitiesResponse as PaginatedActivitiesResponseSchema,
)
from backend_splitbill.model import (
    ExpenseHistory,
    ExpenseHistoryAction,
    Settlement,
    FriendsHistory,
    FriendsHistoryAction,
    ExpenseSplits,
    User,
    Group,
    GroupHistory,
    GroupHistoryAction,
    GroupMember,
    UserHistory,
)

activites_router = APIRouter(prefix="/api/activities", tags=["Activities"])


def create_summary_for_expense(row, current_user_id):
    """Create summary for expense activities"""
    action = row["action"]
    performed_by = row["performed_by_user"]

    if not performed_by:
        return None

    performer_name = performed_by.name

    if action == ExpenseHistoryAction.CREATED.value:
        return f"{"You" if performed_by.id ==current_user_id else performer_name } created {row['expense_title']}"
    elif action == ExpenseHistoryAction.UPDATED.value:
        return f"{"You" if performed_by.id ==current_user_id else performer_name } updated {row['expense_title']}"
    elif action == ExpenseHistoryAction.DELETED.value:
        return f"{"You" if performed_by.id ==current_user_id else performer_name } deleted {row['expense_title']}"
    return None


def create_summary_for_settlement(row, current_user_id):
    """Create summary for settlement activities"""
    from_user = row["performed_by_user"]
    to_user = row["affected_user_obj"]
    amount = row["amount_settled"]

    if not from_user or not to_user:
        return None

    from_user_name = from_user.name
    to_user_name = to_user.name

    # Check if current user is involved
    if from_user.id == current_user_id:
        return f"you paid {amount} to {to_user_name}"
    elif to_user.id == current_user_id:
        return f"{from_user_name} paid {amount} to you"
    else:
        return f"{from_user_name} paid {amount} to {to_user_name}"


def create_summary_for_friend(row, current_user_id):
    """Create summary for friend activities"""
    action = row["action"]
    performed_by = row["performed_by_user"]
    affected_user = row["affected_user_obj"]

    if not performed_by:
        return None

    performer_name = performed_by.name

    if action == FriendsHistoryAction.REQUEST_SENT.value:
        if affected_user:
            affected_name = affected_user.name
            if performed_by.id == current_user_id:
                return f"You sent a friend request to {affected_name}"
            else:
                return f"You sent a friend request to {affected_name}"
        else:
            return f"You sent a friend request to {row["affected_guest"]}"

    elif action == FriendsHistoryAction.REQUEST_CANCELLED.value:
        if affected_user:
            affected_name = affected_user.name
            return f"You cancelled a friend request which was sent to {affected_name}"
        else:
            return f"You cancelled a friend request sent to {row["affected_guest"]}"

    elif action == FriendsHistoryAction.REQUEST_ACCEPTED.value:
        sender = row.get("sender")  # You might need to add sender to your query
        if affected_user:
            affected_name = affected_user.name
            if affected_user.id == current_user_id:
                return f"You accepted {performer_name}'s friend request"
            else:
                return f"{affected_name} accepted your friend request"
        else:
            return f"Friend request accepted"

    elif action == FriendsHistoryAction.FRIEND_REMOVED.value:
        if affected_user:
            affected_name = affected_user.name
            if performed_by.id == current_user_id:
                return f"you removed {affected_name} as a friend"
            else:
                return f"{performer_name} removed {affected_name} as a friend"
        else:
            return f"{performer_name} removed a friend"
    return None


def create_summary_for_group(row, current_user_id):
    """Create summary for group activities"""
    action = row["action"]
    performed_by = row["performed_by_user"]
    affected_user = row["affected_user_obj"]
    group = row.get("group_obj")

    if not performed_by:
        return None

    performer_name = performed_by.name
    group_name = group.name if group else "a group"

    if action == GroupHistoryAction.GROUP_CREATED.value:
        return f"{"You" if performed_by.id ==current_user_id else performer_name } created group {group_name}"

    elif action == GroupHistoryAction.GROUP_UPDATED.value:
        return f"{"You" if performed_by.id ==current_user_id else performer_name } updated group {group_name}"

    elif action == GroupHistoryAction.MEMBER_LEFT.value:
        return f"{"You" if performed_by.id ==current_user_id else performer_name } left group {group_name}"

    elif action == GroupHistoryAction.GROUP_INVITATION_SENT.value:
        if affected_user:
            affected_name = affected_user.name
            return f"{"You" if performed_by.id ==current_user_id else performer_name } sent a group invitation to {affected_name} for {group_name}"
        else:
            guest = row.get("affected_guest", "a guest")
            return f"{"You" if performed_by.id ==current_user_id else performer_name } sent a group invitation to {guest} for {group_name}"

    elif action == GroupHistoryAction.MEMBER_REMOVED.value:
        if affected_user:
            affected_name = affected_user.name
            return f"{"You" if performed_by.id ==current_user_id else performer_name } removed {affected_name} from {group_name}"
        else:
            guest = row.get("affected_guest", "a member")
            return f"{"You" if performed_by.id ==current_user_id else performer_name } removed {guest} from {group_name}"

    elif action == GroupHistoryAction.ADMIN_TRANSFERRED.value:
        if affected_user:
            affected_name = affected_user.name
            return f"{"You" if performed_by.id ==current_user_id else performer_name } transferred admin rights to {affected_name} in {group_name}"
        else:
            guest = row.get("affected_guest", "a member")
            return f"{"You" if performed_by.id ==current_user_id else performer_name } transferred admin rights to {guest} in {group_name}"

    elif action == GroupHistoryAction.GROUP_INVITATION_ACCEPTED.value:
        if affected_user:
            affected_name = affected_user.name
            return f"{affected_name} accepted group invitation for {group_name}"
        else:
            guest = row.get("affected_guest", "a member")
            return f"{guest} accepted group invitation for {group_name}"
    return None


def create_summary_for_user(row, current_user_id):
    """Create summary for user activities"""
    action = row["action"]
    performed_by = row["performed_by_user"]

    if action == "USER_DELETED":
        return "You deleted your account"
    elif action == "USER_UPDATED":
        return "You updated your profile"
    else:
        return f"You {action} your account"


def create_activity_summary(row, current_user_id):
    """Main function to create summary based on activity type"""
    activity_type = row["type"]

    if activity_type in ["EXPENSE", "GROUP_EXPENSE"]:
        return create_summary_for_expense(row, current_user_id)
    elif activity_type in [
        "EXPENSEWISE_SETTLEMENT",
        "GROUPWISE_SETTLEMENT",
        "OVERALL_SETTLEMENT",
    ]:
        return create_summary_for_settlement(row, current_user_id)
    elif activity_type == "FRIEND":
        return create_summary_for_friend(row, current_user_id)
    elif activity_type == "GROUP":
        return create_summary_for_group(row, current_user_id)
    elif activity_type == "USER":
        return create_summary_for_user(row, current_user_id)
    return None


@activites_router.get("/", response_model=PaginatedActivitiesResponseSchema)
async def get_activities_api(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    page: int = 1,
    limit: Annotated[int, Query(gt=0, lt=100)] = 10,
    category: Literal[
        "ALL",
        "EXPENSE",
        "GROUP_EXPENSE",
        "SETTLEMENT",
        "EXPENSEWISE_SETTLEMENT",
        "GROUPWISE_SETTLEMENT",
        "OVERALL_SETTLEMENT",
        "FRIEND",
        "GROUP",
        "USER",
    ] = "ALL",
    performed_by_me: bool | None = None,
    group_id: int | None = None,
    action: str | None = None,
):
    # Base queries without summary
    expense_query = select(
        case(
            (ExpenseHistory.group_id == None, literal("EXPENSE")),
            else_=literal("GROUP_EXPENSE"),
        ).label("type"),
        ExpenseHistory.group_id.label("group_id"),
        cast(ExpenseHistory.action, String).label("action"),
        ExpenseHistory.performed_by.label("performed_by"),
        cast(None, Integer).label("affected_user"),
        cast(None, String).label("affected_guest"),
        case(
            (ExpenseHistory.performed_by == current_user.id, literal(True)),
            else_=literal(False),
        ).label("performed_by_me"),
        ExpenseHistory.performed_at.label("performed_at"),
        cast(None, Numeric(10, 2)).label("amount_settled"),
        ExpenseHistory.expense_title.label("expense_title"),
    ).where(
        ExpenseHistory.expense_id.in_(
            select(ExpenseSplits.expense_id)
            .where(ExpenseSplits.user_id == current_user.id)
            .distinct()
        )
    )

    settlement_query = select(
        case(
            (Settlement.expense_id != None, literal("EXPENSEWISE_SETTLEMENT")),
            (Settlement.group_id != None, literal("GROUPWISE_SETTLEMENT")),
            else_=literal("OVERALL_SETTLEMENT"),
        ).label("type"),
        Settlement.group_id.label("group_id"),
        case(
            (Settlement.from_user == current_user.id, literal("PAID")),
            else_=literal("RECEIVED"),
        ).label("action"),
        Settlement.from_user.label("performed_by"),
        Settlement.to_user.label("affected_user"),
        cast(None, String).label("affected_guest"),
        case(
            (Settlement.from_user == current_user.id, literal(True)),
            else_=literal(False),
        ).label("performed_by_me"),
        Settlement.created_at.label("performed_at"),
        Settlement.amount.label("amount_settled"),
        cast(None, String).label("expense_title"),
    ).where(
        or_(
            Settlement.from_user == current_user.id,
            Settlement.to_user == current_user.id,
        )
    )

    friends_query = select(
        literal("FRIEND").label("type"),
        cast(None, Integer).label("group_id"),
        cast(FriendsHistory.action, String).label("action"),
        FriendsHistory.performed_by.label("performed_by"),
        case(
            (
                or_(
                    FriendsHistory.action == FriendsHistoryAction.REQUEST_SENT,
                    FriendsHistory.action == FriendsHistoryAction.FRIEND_REMOVED,
                    FriendsHistory.action == FriendsHistoryAction.REQUEST_CANCELLED,
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
            else_=cast(None, String),
        ).label("affected_guest"),
        case(
            (FriendsHistory.performed_by == current_user.id, literal(True)),
            else_=literal(False),
        ).label("performed_by_me"),
        FriendsHistory.performed_at.label("performed_at"),
        cast(None, Numeric(10, 2)).label("amount_settled"),
        cast(None, String).label("expense_title"),
    ).where(
        or_(
            and_(
                FriendsHistory.performed_by == current_user.id,
                FriendsHistory.action.in_(
                    [
                        FriendsHistoryAction.REQUEST_SENT,
                        FriendsHistoryAction.REQUEST_CANCELLED,
                    ]
                ),
            ),
            and_(
                or_(
                    FriendsHistory.sender_id == current_user.id,
                    FriendsHistory.receiver_id == current_user.id,
                ),
                FriendsHistory.action.in_(
                    [
                        FriendsHistoryAction.REQUEST_ACCEPTED,
                        FriendsHistoryAction.FRIEND_REMOVED,
                    ]
                ),
            ),
        )
    )

    group_query = select(
        literal("GROUP").label("type"),
        GroupHistory.group_id.label("group_id"),
        cast(GroupHistory.action, String).label("action"),
        GroupHistory.performed_by.label("performed_by"),
        case(
            (
                or_(
                    GroupHistory.action == GroupHistoryAction.GROUP_CREATED,
                    GroupHistory.action == GroupHistoryAction.GROUP_UPDATED,
                    GroupHistory.action == GroupHistoryAction.MEMBER_LEFT,
                ),
                cast(None, Integer),
            ),
            (
                or_(
                    GroupHistory.action == GroupHistoryAction.GROUP_INVITATION_SENT,
                    GroupHistory.action == GroupHistoryAction.MEMBER_REMOVED,
                    GroupHistory.action == GroupHistoryAction.ADMIN_TRANSFERRED,
                ),
                GroupHistory.receiver_id,
            ),
            (
                GroupHistory.action == GroupHistoryAction.GROUP_INVITATION_ACCEPTED,
                GroupHistory.sender_id,
            ),
        ).label("affected_user"),
        case(
            (GroupHistory.guest_invitee.is_not(None), GroupHistory.guest_invitee),
            else_=cast(None, String),
        ).label("affected_guest"),
        case(
            (GroupHistory.performed_by == current_user.id, literal(True)),
            else_=literal(False),
        ).label("performed_by_me"),
        GroupHistory.performed_at.label("performed_at"),
        cast(None, Numeric(10, 2)).label("amount_settled"),
        cast(None, String).label("expense_title"),
    ).where(
        GroupHistory.group_id.in_(
            select(GroupMember.group_id).where(GroupMember.user_id == current_user.id)
        )
    )

    user_query = select(
        literal("USER").label("type"),
        cast(None, Integer).label("group_id"),
        cast(UserHistory.action, String).label("action"),
        UserHistory.user_id.label("performed_by"),
        cast(None, Integer).label("affected_user"),
        cast(None, String).label("affected_guest"),
        literal(True).label("performed_by_me"),
        UserHistory.performed_at.label("performed_at"),
        cast(None, Numeric(10, 2)).label("amount_settled"),
        cast(None, String).label("expense_title"),
    ).where(UserHistory.user_id == current_user.id)

    # Build query based on category
    query = []

    if category == "ALL":
        query = [
            expense_query,
            settlement_query,
            friends_query,
            group_query,
            user_query,
        ]
    elif category == "EXPENSE":
        query = [expense_query.where(ExpenseHistory.group_id.is_(None))]
    elif category == "GROUP_EXPENSE":
        query = [expense_query.where(ExpenseHistory.group_id.is_not(None))]
    elif category == "SETTLEMENT":
        query = [settlement_query]
    elif category == "EXPENSEWISE_SETTLEMENT":
        query = [settlement_query.where(Settlement.expense_id.is_not(None))]
    elif category == "GROUPWISE_SETTLEMENT":
        query = [settlement_query.where(Settlement.group_id.is_not(None))]
    elif category == "OVERALL_SETTLEMENT":
        query = [
            settlement_query.where(
                Settlement.expense_id.is_(None),
                Settlement.group_id.is_(None),
            )
        ]
    elif category == "FRIEND":
        query = [friends_query]
    elif category == "GROUP":
        query = [group_query]
    elif category == "USER":
        query = [user_query]

    activities = union_all(*query).subquery()

    PerformedBy = aliased(User, name="performed_by_user")
    AffectedUser = aliased(User, name="affected_user_obj")
    GroupObj = aliased(Group, name="group_obj")

    activity_query = (
        select(activities, PerformedBy, AffectedUser, GroupObj)
        .outerjoin(PerformedBy, PerformedBy.id == activities.c.performed_by)
        .outerjoin(AffectedUser, AffectedUser.id == activities.c.affected_user)
        .outerjoin(GroupObj, GroupObj.id == activities.c.group_id)
    )

    if performed_by_me is not None:
        activity_query = activity_query.where(
            activities.c.performed_by_me == performed_by_me
        )

    if group_id is not None:
        activity_query = activity_query.where(activities.c.group_id == group_id)

    if action is not None:
        activity_query = activity_query.where(activities.c.action == action)

    # Get total count
    total_query = select(func.count()).select_from(activity_query.subquery())
    result = await db.execute(total_query)
    total_activities = result.scalar_one()

    # Get paginated results
    skip = limit * (page - 1)
    result = await db.execute(
        activity_query.order_by(activities.c.performed_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = result.mappings().all()

    # Build activities with proper summaries
    activities_result = []
    for row in rows:
        # Create summary using the helper functions
        summary = create_activity_summary(row, current_user.id)

        activity = {
            "type": row["type"],
            "group_name": row["group_obj"].name if row["group_obj"] else None,
            "action": row["action"],
            "performed_by": row["performed_by_user"],
            "affected_user": row["affected_user_obj"],
            "affected_guest": row["affected_guest"],
            "performed_by_me": row["performed_by_me"],
            "performed_at": row["performed_at"],
            "amount_settled": row["amount_settled"],
            "summary": summary,
        }
        activities_result.append(activity)

    return PaginatedActivitiesResponseSchema(
        activities=activities_result,
        page=page,
        skip=skip,
        limit=limit,
        has_more=skip + len(activities_result) < total_activities,
    )
