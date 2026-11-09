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


async def get_friend_settlement_data(
    friend_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    expense_ids=None,
):

    friend = await db.execute(select(User).where(User.id == friend_id))

    if not expense_ids:
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

        creditors = {}
        debtors = {}
        original_creditors, original_debtors = get_creditors_debtors(
            splits, creditors, debtors, settlement_groups
        )

        creditor_ids = list(original_creditors)
        debtor_ids = list(original_debtors)

        i = 0  # creditor
        j = 0  # debtor

        your_logs = []
        other_logs = []
        expensewise_balance = Decimal("0")

        while i < len(original_creditors) and j < len(original_debtors):
            creditor_id = creditor_ids[i]
            debtor_id = debtor_ids[j]

            creditor = original_creditors[creditor_id]
            debtor = original_debtors[debtor_id]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)
            adjusted_creditor = creditors.get(creditor_id)
            adjusted_debtor = debtors.get(debtor_id)
            balance_transfer = (
                min(
                    adjusted_creditor["balance"],
                    abs(adjusted_debtor["balance"]),
                )
                if adjusted_creditor is not None and adjusted_debtor is not None
                else Decimal("0")
            )

            if friend_id and friend_id not in users_involed:
                if creditor["user"].id == current_user.id:
                    friend_balances[debtor["user"].id] = (
                        friend_balances.get(debtor["user"].id, Decimal("0"))
                        + balance_transfer
                    )
                elif debtor["user"].id == current_user.id:
                    friend_balances[creditor["user"].id] = (
                        friend_balances.get(creditor["user"].id, Decimal("0"))
                        - balance_transfer
                    )

                creditor["balance"] -= transfer
                debtor["balance"] += transfer

                if creditor["balance"] <= Decimal("0"):
                    i += 1

                if abs(debtor["balance"]) <= Decimal("0"):
                    j += 1

                continue

            # you're a creditor then you "lent"
            if (
                creditor["user"].id == current_user.id
                and debtor["user"].id == friend_id
            ):
                your_logs.append(
                    {
                        "to_user": UserDetailSchema.model_validate(debtor["user"]),
                        "amount": transfer,
                    }
                )
                total_balance += balance_transfer
                if expense.group_id:
                    group_balance += balance_transfer
                else:
                    individual_balance += balance_transfer

                expensewise_balance += balance_transfer

                friend_balances[debtor["user"].id] = (
                    friend_balances.get(debtor["user"].id, Decimal("0"))
                    + balance_transfer
                )

            # you're a debtor then you "borrowed"
            elif (
                debtor["user"].id == current_user.id
                and creditor["user"].id == friend_id
            ):
                your_logs.append(
                    {
                        "to_user": UserDetailSchema.model_validate(creditor["user"]),
                        "amount": -transfer,
                    }
                )
                total_balance -= balance_transfer
                if expense.group_id:
                    group_balance -= balance_transfer
                else:
                    individual_balance -= balance_transfer

                expensewise_balance -= balance_transfer

                friend_balances[creditor["user"].id] = (
                    friend_balances.get(creditor["user"].id, Decimal("0"))
                    - balance_transfer
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

            if adjusted_creditor is not None:
                adjusted_creditor["balance"] = max(
                    adjusted_creditor["balance"] - balance_transfer,
                    Decimal("0"),
                )
            if adjusted_debtor is not None:
                adjusted_debtor["balance"] = min(
                    adjusted_debtor["balance"] + balance_transfer,
                    Decimal("0"),
                )

        if friend_id and friend_id not in users_involed:
            continue

        settlements.append(
            {
                "expense": expense,
                "splits": splits,
                "your_settlements": your_logs,
                "other_settlements": other_logs,
                "your_expensewise_balance_with_friend": expensewise_balance,
            }
        )

    individual_expenses = [
        item
        for item in settlements
        if item["expense"].group_id is None
        and item["your_expensewise_balance_with_friend"] != 0
    ]
    creditors = [
        item
        for item in individual_expenses
        if item["your_expensewise_balance_with_friend"] > 0
    ]
    debtors = [
        item
        for item in individual_expenses
        if item["your_expensewise_balance_with_friend"] < 0
    ]

    i = 0  # creditor
    j = 0  # debtor

    while i < len(creditors) and j < len(debtors):
        creditor = creditors[i]
        debtor = debtors[j]

        credit_balance = creditor["your_expensewise_balance_with_friend"]
        debt_balance = abs(debtor["your_expensewise_balance_with_friend"])

        offset = min(credit_balance, debt_balance)

        creditor["your_expensewise_balance_with_friend"] -= offset
        debtor["your_expensewise_balance_with_friend"] += offset

        if creditor["your_expensewise_balance_with_friend"] == 0:
            i += 1
        if debtor["your_expensewise_balance_with_friend"] == 0:
            j += 1

    return {
        "friend": friend.scalars().one_or_none(),
        "settlements": settlements,
        "friend_balances": friend_balances,
        "total_balance": total_balance,
        "group_balance": group_balance,
        "individual_balance": individual_balance,
    }
