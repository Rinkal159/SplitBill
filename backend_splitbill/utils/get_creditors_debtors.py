from decimal import Decimal


def get_creditors_debtors(splits, creditors, debtors, settlement_groups):
    balance_creditors = {}
    original_creditors = {}
    original_debtors = {}

    for split in splits:
        balance = split.paid_amount - split.share_amount
        if balance > 0:
            original_creditors[split.user.id] = {"user": split.user, "balance": balance}
            creditors[split.user.id] = {"user": split.user, "balance": balance}

        elif balance < 0:
            original_debtors[split.user.id] = {"user": split.user, "balance": balance}
            existed_settlement = settlement_groups.get(split.id, [])

            total_amount_settled = Decimal("0")

            if existed_settlement:
                for settlement_split in existed_settlement:
                    total_amount_settled += settlement_split.amount_settled

                    creditor_id = settlement_split.settlement.to_user
                    balance_creditors[creditor_id] = (
                        balance_creditors.get(creditor_id, Decimal("0"))
                        + settlement_split.amount_settled
                    )

            balance += total_amount_settled

            if balance < 0:
                debtors[split.user.id] = {"user": split.user, "balance": balance}

    for user_id, creditor in creditors.items():
        remaining = creditor["balance"] - balance_creditors.get(user_id, Decimal("0"))
        creditor["balance"] = max(remaining, Decimal("0"))

    return original_creditors, original_debtors
