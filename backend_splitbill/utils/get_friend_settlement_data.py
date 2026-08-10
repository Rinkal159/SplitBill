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

from backend_splitbill.model import Friends, ExpenseSplits, User


# need to think, this is specifically for friends so both users must have friendhsip to get balances
async def get_friend_settlement_data(
    friend_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    friend = await db.execute(select(User).where(User.id == friend_id))
    
    your_expenses = select(ExpenseSplits.expense_id).where(
        ExpenseSplits.user_id == current_user.id
    )

    expenses_you_and_friend_involved = await db.execute(
        select(ExpenseSplits.expense_id).where(
            ExpenseSplits.user_id == friend_id,
            ExpenseSplits.expense_id.in_(your_expenses),
        )
    )

    expense_ids = expenses_you_and_friend_involved.scalars().all()

    expense_groups = await get_expense_groups(
        expense_ids=expense_ids, db=db, newest_first=True
    )

    settlements, total_balance = await get_main_settlement_logic(
        expense_groups=expense_groups, db=db, you=current_user, other=friend_id
    )

    return {
        "friend": friend.scalars().one_or_none(),
        "expense_groups": expense_groups,
        "settlements": settlements,
        "total_balance": total_balance,
    }
