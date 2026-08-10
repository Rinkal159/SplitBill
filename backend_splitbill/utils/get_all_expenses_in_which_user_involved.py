from backend_splitbill.utils.get_expense_groups import get_expense_groups
from backend_splitbill.utils.get_settlement_groups import get_settlement_groups
from backend_splitbill.utils.get_creditors_debtors import get_creditors_debtors
from backend_splitbill.schemas.expense_schema import UserDetail as UserDetailSchema
from decimal import Decimal

async def get_all_expenses_in_which_user_involved(expense_ids, db, current_user):
    # sorted in descending order of expense date
    expense_groups = await get_expense_groups(
        expense_ids=expense_ids, db=db, newest_first=True
    )

    settlements = []

    for splits in expense_groups:
        settlement_groups = await get_settlement_groups(splits, db)
        expense = splits[0].expense

        creditors = []
        debtors = []
        get_creditors_debtors(splits, creditors, debtors, settlement_groups)

        i = 0  # creditor
        j = 0  # debtor

        your_logs = []
        other_logs = []

        while i < len(creditors) and j < len(debtors):
            creditor = creditors[i]
            debtor = debtors[j]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)

            # you're a creditor then you "lent"
            if creditor["user"].id == current_user.id:
                your_logs.append(
                    {
                        "to_user": UserDetailSchema.model_validate(debtor["user"]),
                        "amount": transfer,
                    }
                )

            # you're a debtor then you "borrowed"
            elif debtor["user"].id == current_user.id:
                your_logs.append(
                    {
                        "to_user": UserDetailSchema.model_validate(creditor["user"]),
                        "amount": -transfer,
                    }
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

        settlements.append(
            {
                "expense": expense,
                "your_settlements": your_logs,
                "other_settlements": other_logs,
            }
        )
        
    return settlements
