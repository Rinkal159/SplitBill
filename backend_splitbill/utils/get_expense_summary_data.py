from collections import defaultdict

from sqlalchemy import or_, select
from sqlalchemy.orm import aliased, lazyload

from backend_splitbill.model import Settlement, SettlementSplits, User
from backend_splitbill.schemas.expense_schema import UserDetail as UserDetailSchema


async def get_expense_summary_data(expense_groups, db, current_user):
    """Return participant splits and this user's settlement history per expense."""
    splits_by_expense = {}
    split_by_id = {}

    for splits in expense_groups:
        if not splits:
            continue
        expense_id = splits[0].expense_id
        splits_by_expense[expense_id] = [
            {
                "user": UserDetailSchema.model_validate(split.user),
                "share_amount": split.share_amount,
                "paid_amount": split.paid_amount,
                "split_value": split.split_value,
            }
            for split in splits
        ]
        split_by_id.update({split.id: expense_id for split in splits})

    history_by_expense = defaultdict(dict)
    split_ids = list(split_by_id)
    if split_ids:
        expense_ids = list(splits_by_expense)
        payer = aliased(User)
        receiver = aliased(User)
        result = await db.execute(
            select(
                SettlementSplits.split_id,
                Settlement.expense_id,
                Settlement.id,
                Settlement.from_user,
                Settlement.to_user,
                Settlement.amount,
                Settlement.payment_method,
                Settlement.settlement_date,
                Settlement.status,
                Settlement.note,
                SettlementSplits.amount_settled,
                payer,
                receiver,
            )
            .select_from(Settlement)
            .outerjoin(
                SettlementSplits,
                SettlementSplits.settlement_id == Settlement.id,
            )
            .join(payer, payer.id == Settlement.from_user)
            .join(receiver, receiver.id == Settlement.to_user)
            .where(
                or_(
                    Settlement.expense_id.in_(expense_ids),
                    SettlementSplits.split_id.in_(split_ids),
                ),
                or_(
                    Settlement.from_user == current_user.id,
                    Settlement.to_user == current_user.id,
                ),
            )
            .options(lazyload("*"))
            .order_by(Settlement.settlement_date.desc(), Settlement.id.desc())
        )

        for row in result.all():
            (
                split_id,
                direct_expense_id,
                settlement_id,
                from_user_id,
                to_user_id,
                total_amount,
                payment_method,
                settlement_date,
                status,
                note,
                amount_settled,
                payer_user,
                receiver_user,
            ) = row
            expense_id = (
                split_by_id.get(split_id) if split_id is not None else direct_expense_id
            )
            if expense_id not in splits_by_expense:
                continue
            history = history_by_expense[expense_id]
            record = history.get(settlement_id)
            if record is None:
                is_payer = from_user_id == current_user.id
                counterparty_user = receiver_user if is_payer else payer_user
                counterparty = UserDetailSchema.model_validate(counterparty_user)
                record = {
                    "id": settlement_id,
                    "direction": "PAID" if is_payer else "RECEIVED",
                    "counterparty": counterparty,
                    "amount": amount_settled if amount_settled is not None else total_amount,
                    "total_amount": total_amount,
                    "payment_method": payment_method,
                    "settlement_date": settlement_date,
                    "status": status,
                    "note": note,
                }
                history[settlement_id] = record
            else:
                record["amount"] += (
                    amount_settled if amount_settled is not None else total_amount
                )

    summary = {}
    for expense_id, splits in splits_by_expense.items():
        summary[expense_id] = {
            "expense_splits": splits,
            "settlement_history": list(history_by_expense[expense_id].values()),
        }
    return summary
