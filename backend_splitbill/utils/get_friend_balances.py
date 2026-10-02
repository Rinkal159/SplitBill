from backend_splitbill.utils.get_expense_groups import get_expense_groups
from backend_splitbill.utils.get_settlement_groups import get_settlement_groups
from backend_splitbill.utils.get_creditors_debtors import get_creditors_debtors
from decimal import Decimal


async def get_friend_balances(expense_ids, db, current_user):
    expense_groups = await get_expense_groups(
        expense_ids=expense_ids, db=db, newest_first=True
    )

    friend_balances = {}

    for splits in expense_groups:
        settlement_groups = await get_settlement_groups(splits=splits, db=db)

        creditors = []
        debtors = []
        get_creditors_debtors(
            splits=splits,
            settlement_groups=settlement_groups,
            creditors=creditors,
            debtors=debtors,
        )

        i = 0
        j = 0

        while i < len(creditors) and j < len(debtors):
            creditor = creditors[i]
            debtor = debtors[j]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)

            if creditor["user"].id == current_user.id:
                friend_id = debtor["user"].id
                friend_balances[friend_id] = (
                    friend_balances.get(friend_id, Decimal("0")) + transfer
                )
            elif debtor["user"].id == current_user.id:
                friend_id = creditor["user"].id
                friend_balances[friend_id] = (
                    friend_balances.get(friend_id, Decimal("0")) - transfer
                )

            if creditor["balance"] <= Decimal("0"):
                i += 1

            if abs(debtor["balance"]) <= Decimal("0"):
                j += 1

    return friend_balances
