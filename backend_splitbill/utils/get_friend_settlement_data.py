from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, HTTPException, status
from backend_splitbill.database import get_db
from backend_splitbill.auth.authentication import get_current_user
from sqlalchemy.orm import selectinload
from backend_splitbill.utils.get_expense_groups import get_expense_groups
from backend_splitbill.utils.get_creditors_debtors import get_creditors_debtors
from decimal import Decimal
from backend_splitbill.utils.get_settlement_groups import get_settlement_groups
from backend_splitbill.utils.get_main_settlement_logic import get_main_settlement_logic
from backend_splitbill.utils.get_all_expenses_in_which_user_involved import (
    get_all_expenses_in_which_user_involved,
)
from backend_splitbill.utils.get_friend_balances import get_friend_balances
from backend_splitbill.utils.get_expenses_with_friend import get_expenses_with_friend

from backend_splitbill.model import Friends, ExpenseSplits, User


# need to think, this is specifically for friends so both users must have friendhsip to get balances
async def get_friend_settlement_data(
    friend_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    friend = await db.execute(select(User).where(User.id == friend_id))

    expense_ids = await get_expenses_with_friend(db, current_user, friend_id)
    
    expense_groups = await get_expense_groups(
        expense_ids=expense_ids["expense_ids"], db=db, newest_first=True
    )

    (
        settlements,
        friend_balances,
        total_balance,
    ) = await get_all_expenses_in_which_user_involved(
        expense_ids=expense_ids["expense_ids"],
        db=db,
        current_user=current_user,
        friend_id=friend_id,
    )

    return {
        "friend": friend.scalars().one_or_none(),
        "expense_groups": expense_groups,
        "settlements": settlements,
        "friend_balances": friend_balances,
        "total_balance": total_balance,
    }
