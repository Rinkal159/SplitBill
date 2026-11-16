from sqlalchemy import select
from sqlalchemy.orm import aliased
from backend_splitbill.model import ExpenseSplits


async def get_expenses_with_friend(db, current_user, friend_id):
    friend_split = aliased(ExpenseSplits)
    result = await db.execute(
        select(ExpenseSplits.expense_id)
        .join(friend_split, friend_split.expense_id == ExpenseSplits.expense_id)
        .where(
            ExpenseSplits.user_id == current_user.id,
            friend_split.user_id == friend_id,
        )
        .distinct()
    )
    shared_expense_ids = result.scalars().all()

    return {
        "expense_ids": shared_expense_ids,
        "expenses_ids_with_your_friend": shared_expense_ids,
    }
