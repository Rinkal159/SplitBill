from sqlalchemy import select
from backend_splitbill.model import ExpenseSplits

async def get_expenses_with_friend(db, current_user, friend_id):

    # your expenses
    your_expenses = await db.execute(
        select(ExpenseSplits.expense_id).where(ExpenseSplits.user_id == current_user.id)
    )
    expense_ids = your_expenses.scalars().all()

    # your and friend expenses
    expenses_you_and_friend_involved = await db.execute(
        select(ExpenseSplits.expense_id).where(
            ExpenseSplits.user_id == friend_id,
            ExpenseSplits.expense_id.in_(expense_ids),
        )
    )
    expenses_ids_with_your_friend = expenses_you_and_friend_involved.scalars().all()

    return {
        "expense_ids" : expense_ids,
        "expenses_ids_with_your_friend" : expenses_ids_with_your_friend
    }