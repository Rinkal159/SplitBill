from decimal import Decimal
from backend_splitbill.utils.get_settlement_groups import get_settlement_groups
from backend_splitbill.utils.get_creditors_debtors import get_creditors_debtors


async def get_main_settlement_logic(expense_groups, db, you, other):
    settlements = []
    total_balance = Decimal("0")

    for splits in expense_groups:
        settlement_groups = await get_settlement_groups(splits, db)
        expense = splits[0].expense

        creditors = {}
        debtors = {}
        _, _ = get_creditors_debtors(splits, creditors, debtors, settlement_groups)

        creditor_ids = list(creditors)
        debtor_ids = list(debtors)

        i = 0  # creditor
        j = 0  # debtor

        net_balance = Decimal("0")

        while i < len(creditors) and j < len(debtors):
            creditor_id = creditor_ids[i]
            debtor_id = debtor_ids[j]

            creditor = creditors[creditor_id]
            debtor = debtors[debtor_id]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)

            # you "lent" to friend
            if creditor["user"].id == you.id and debtor["user"].id == other:
                net_balance += transfer
                total_balance += transfer

            # you "borrowed" from friend
            elif debtor["user"].id == you.id and creditor["user"].id == other:
                net_balance += -transfer
                total_balance -= transfer

            creditor["balance"] -= transfer
            debtor["balance"] += transfer

            if creditor["balance"] <= Decimal("0"):
                i += 1

            if abs(debtor["balance"]) <= Decimal("0"):
                j += 1

        settlements.append(
            {"expense": expense, "splits": splits, "net_balance": net_balance}
        )

    return settlements, total_balance
