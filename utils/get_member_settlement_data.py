from sqlalchemy import select
from model import Group, GroupMember, Expense, User
from fastapi import HTTPException, status
from utils.get_expense_groups import get_expense_groups
from utils.get_main_settlement_logic import get_main_settlement_logic


async def get_member_settlement_data(group_id: int, user_id: int, db, current_user):
    # if group doesn't exist
    result = await db.execute(select(Group).where(Group.id == group_id))
    existed_group = result.scalars().one_or_none()

    if not existed_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )

    # if user_id is you
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot fetch balance with yourself",
        )

    # if you or to_user are not member of that group
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id.in_([current_user.id, user_id]),
        )
    )
    existed_members = result.scalars().all()

    if len(existed_members) != 2:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You and lender must be in the group to settle up",
        )

    result = await db.execute(select(Expense.id).where(Expense.group_id == group_id))
    expense_ids = result.scalars().all()

    expense_groups = await get_expense_groups(
        expense_ids=expense_ids, db=db, newest_first=True
    )

    settlements, total_balance = await get_main_settlement_logic(
        expense_groups=expense_groups, db=db, you=current_user, other=user_id
    )

    result = await db.execute(select(User).where(User.id == user_id))
    return {
        "member": result.scalars().one_or_none(),
        "expense_groups": expense_groups,
        "settlements": settlements,
        "total_balance": total_balance,
    }
