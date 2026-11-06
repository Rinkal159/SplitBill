from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from backend_splitbill.database import get_db
from backend_splitbill.auth.authentication import get_current_user
from backend_splitbill.utils.get_expense_groups import get_expense_groups
from backend_splitbill.utils.get_creditors_debtors import get_creditors_debtors
from decimal import Decimal
from backend_splitbill.utils.get_settlement_groups import get_settlement_groups
from backend_splitbill.utils.get_expenses_with_friend import get_expenses_with_friend

from backend_splitbill.model import User
from backend_splitbill.schemas.expense_schema import UserDetail as UserDetailSchema


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
    
    settlements = []
    friend_balances = {}
    total_balance = Decimal("0")
    group_balance = Decimal("0")
    individual_balance = Decimal("0")

    for splits in expense_groups:
        users_involed = [split.user_id for split in splits]

        settlement_groups = await get_settlement_groups(splits, db)
        expense = splits[0].expense

        creditors = []
        debtors = []
        get_creditors_debtors(splits, creditors, debtors, settlement_groups)

        i = 0  # creditor
        j = 0  # debtor

        your_logs = []
        other_logs = []
        expensewise_balance = Decimal("0")

        while i < len(creditors) and j < len(debtors):
            creditor = creditors[i]
            debtor = debtors[j]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)

            if friend_id and friend_id not in users_involed:
                if creditor["user"].id == current_user.id:
                    friend_balances[debtor["user"].id] = (
                        friend_balances.get(debtor["user"].id, Decimal("0")) + transfer
                    )
                elif debtor["user"].id == current_user.id:
                    friend_balances[creditor["user"].id] = (
                        friend_balances.get(creditor["user"].id, Decimal("0"))
                        - transfer
                    )

                creditor["balance"] -= transfer
                debtor["balance"] += transfer

                if creditor["balance"] <= Decimal("0"):
                    i += 1

                if abs(debtor["balance"]) <= Decimal("0"):
                    j += 1

                continue

            # you're a creditor then you "lent"
            if creditor["user"].id == current_user.id and debtor["user"].id == friend_id:
                your_logs.append(
                    {
                        "to_user": UserDetailSchema.model_validate(debtor["user"]),
                        "amount": transfer,
                    }
                )
                total_balance += transfer
                if (expense.group_id):
                    group_balance += transfer
                else:
                    individual_balance += transfer
                    
                expensewise_balance += transfer

                friend_balances[debtor["user"].id] = (
                    friend_balances.get(debtor["user"].id, Decimal("0")) + transfer
                )

            # you're a debtor then you "borrowed"
            elif debtor["user"].id == current_user.id and creditor["user"].id == friend_id:
                your_logs.append(
                    {
                        "to_user": UserDetailSchema.model_validate(creditor["user"]),
                        "amount": -transfer,
                    }
                )
                total_balance -= transfer
                if (expense.group_id):
                        group_balance -= transfer
                else:
                    individual_balance -= transfer
                    
                expensewise_balance -= transfer
                    
                friend_balances[creditor["user"].id] = (
                    friend_balances.get(creditor["user"].id, Decimal("0")) - transfer
                )

            # other settlements
            else:
                other_logs.append(
                    {
                        "from_user": UserDetailSchema.model_validate(debtor["user"]),
                        "to_user": UserDetailSchema.model_validate(creditor["user"]),
                        "amount": -transfer,
                    }
                )

            creditor["balance"] -= transfer
            debtor["balance"] += transfer

            if creditor["balance"] <= Decimal("0"):
                i += 1

            if abs(debtor["balance"]) <= Decimal("0"):
                j += 1

        if friend_id and friend_id not in users_involed:
            continue

        settlements.append(
            {
                "expense": expense,
                "your_settlements": your_logs,
                "other_settlements": other_logs,
                "your_expensewise_balance_with_friend": expensewise_balance
            }
        )
    
    return {
        "friend": friend.scalars().one_or_none(),
        "settlements": settlements,
        "friend_balances": friend_balances,
        "total_balance": total_balance,
        "group_balance" : group_balance,
        "individual_balance" : individual_balance
    }
