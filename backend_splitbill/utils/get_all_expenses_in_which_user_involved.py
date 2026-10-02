from backend_splitbill.utils.get_expense_groups import get_expense_groups
from backend_splitbill.utils.get_settlement_groups import get_settlement_groups
from backend_splitbill.utils.get_creditors_debtors import get_creditors_debtors
from backend_splitbill.schemas.expense_schema import UserDetail as UserDetailSchema
from decimal import Decimal


async def get_all_expenses_in_which_user_involved(
    expense_ids, db, current_user, friend_id=None
):
    # sorted in descending order of expense date
    expense_groups = await get_expense_groups(
        expense_ids=expense_ids, db=db, newest_first=True
    )

    settlements = []
    total_balance_with_friend = Decimal("0")
    friend_balances = {}

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
        your_balance = Decimal("0")
        your_expensewise_balance_with_friend = Decimal("0")

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
            if creditor["user"].id == current_user.id:
                your_logs.append(
                    {
                        "to_user": UserDetailSchema.model_validate(debtor["user"]),
                        "amount": transfer,
                    }
                )
                your_balance += transfer
                
                if friend_id and debtor["user"].id == friend_id:
                    total_balance_with_friend += transfer
                    your_expensewise_balance_with_friend += transfer

                friend_balances[debtor["user"].id] = (
                    friend_balances.get(debtor["user"].id, Decimal("0")) + transfer
                )

            # you're a debtor then you "borrowed"
            elif debtor["user"].id == current_user.id:
                your_logs.append(
                    {
                        "to_user": UserDetailSchema.model_validate(creditor["user"]),
                        "amount": -transfer,
                    }
                )
                your_balance -= transfer
                
                if friend_id and creditor["user"].id == friend_id:
                    total_balance_with_friend -= transfer
                    your_expensewise_balance_with_friend -= transfer
                    
                friend_balances[creditor["user"].id] = (
                    friend_balances.get(creditor["user"].id, Decimal("0")) - transfer
                )

            # other settlements
            else:
                other_logs.append(
                    {
                        "from_user": UserDetailSchema.model_validate(debtor["user"]),
                        "to_user": UserDetailSchema.model_validate(creditor["user"]),
                        "amount": transfer,
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
                "your_balance": your_balance,
                "your_expensewise_balance_with_friend": your_expensewise_balance_with_friend
            }
        )

    return settlements, friend_balances, total_balance_with_friend
