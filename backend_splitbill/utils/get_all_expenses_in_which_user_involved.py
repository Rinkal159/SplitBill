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
    total_balance = Decimal("0")
    friend_balances = {}

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
        your_balance = Decimal("0")
        balances_by_user = {}

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

            # you're a creditor then you "lent"
            if creditor["user"].id == current_user.id:
                your_logs.append(
                    {
                        "to_user": UserDetailSchema.model_validate(debtor["user"]),
                        "amount": transfer,
                    }
                )
                your_balance += balance_transfer
                total_balance += balance_transfer
                friend_balances[debtor["user"].id] = (
                    friend_balances.get(debtor["user"].id, Decimal("0"))
                    + balance_transfer
                )
                balances_by_user[debtor["user"].id] = (
                    balances_by_user.get(debtor["user"].id, Decimal("0"))
                    + balance_transfer
                )

            # you're a debtor then you "borrowed"
            elif debtor["user"].id == current_user.id:
                your_logs.append(
                    {
                        "to_user": UserDetailSchema.model_validate(creditor["user"]),
                        "amount": -transfer,
                    }
                )
                your_balance -= balance_transfer
                total_balance -= balance_transfer
                friend_balances[creditor["user"].id] = (
                    friend_balances.get(creditor["user"].id, Decimal("0"))
                    - balance_transfer
                )
                balances_by_user[creditor["user"].id] = (
                    balances_by_user.get(creditor["user"].id, Decimal("0"))
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

        settlements.append(
            {
                "expense": expense,
                "your_settlements": your_logs,
                "other_settlements": other_logs,
                "your_balance": your_balance,
                "_balances_by_user": balances_by_user,
            }
        )

    # Offset opposite balances across individual expenses with the same person.
    individual_expenses_by_user = {}
    for item in settlements:
        if item["expense"].group_id is None:
            for user_id, balance in item["_balances_by_user"].items():
                if balance > 0:
                    individual_expenses_by_user.setdefault(user_id, ([], []))[0].append(
                        (item, user_id, balance)
                    )
                elif balance < 0:
                    individual_expenses_by_user.setdefault(user_id, ([], []))[1].append(
                        (item, user_id, balance)
                    )

    for creditors, debtors in individual_expenses_by_user.values():
        i = 0
        j = 0
        while i < len(creditors) and j < len(debtors):
            creditor, creditor_user_id, credit_balance = creditors[i]
            debtor, debtor_user_id, debt_balance = debtors[j]
            offset = min(credit_balance, abs(debt_balance))

            creditor["your_balance"] -= offset
            debtor["your_balance"] += offset
            creditor["_balances_by_user"][creditor_user_id] -= offset
            debtor["_balances_by_user"][debtor_user_id] += offset

            creditors[i] = (creditor, creditor_user_id, credit_balance - offset)
            debtors[j] = (debtor, debtor_user_id, debt_balance + offset)
            if creditors[i][2] == 0:
                i += 1
            if debtors[j][2] == 0:
                j += 1

    for item in settlements:
        item.pop("_balances_by_user")

    return settlements, friend_balances, total_balance
