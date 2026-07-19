from utils.get_settlement_groups import get_settlement_groups
from decimal import Decimal

async def get_settlement_creditors_debtors(splits, db, creditors, debtors):
    settlement_splits = await get_settlement_groups(splits, db)
    balance_creditors = {}
    
    for split in splits:
        balance = split.paid_amount - split.share_amount
        if balance > 0:
            creditors.append(
                {"user": split.user, "balance": balance, "split_id": split.id}
            )
        elif balance < 0:
            existed_settlement = settlement_splits.get(split.id, [])
            total_balance = Decimal("0")
            if existed_settlement:
                for settlement_id in existed_settlement:
                    total_balance += settlement_id.amount_settled
                    creditor_id = settlement_id.settlement.to_user
                    balance_creditors[creditor_id] = (
                        balance_creditors.get(creditor_id, Decimal("0"))
                        + settlement_id.amount_settled
                    )
            balance += total_balance
            if balance < 0:
                debtors.append(
                    {"user": split.user, "balance": balance, "split_id": split.id}
                )

    for c in creditors:
        remaining = c["balance"] - balance_creditors.get(c["user"].id, Decimal("0"))
        if remaining > 0:
            c["balance"] = remaining
        else:
            c["balance"] = Decimal("0")