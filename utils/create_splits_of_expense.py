from decimal import Decimal, ROUND_HALF_UP
from model import ExpenseSplits

async def create_expense_splits(db, expense, participant_ids, expense_data):
    # should "equally" pay
        if expense.split_method == "equal":
            share = (expense.total_amount / Decimal(len(participant_ids))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

            share_amounts = {user_id: share for user_id in participant_ids}

        # should pay "amount" wise
        elif expense.split_method == "amount":
            share_amounts = {
                split.user_id: split.amount for split in expense.expense_splits  # type: ignore
            }

        # should pay "percentage" wise
        else:
            share_amounts = {
                split.user_id: expense.total_amount * split.percentage / Decimal("100")  # type: ignore
                for split in expense.expense_splits  # type: ignore
            }

        # each participant actually paid
        paid_amounts = {payment.user_id: payment.amount for payment in expense.payments}

        for participant_id in participant_ids:
            new_split = ExpenseSplits(
                expense_id=expense_data.id,
                user_id=participant_id,
                share_amount=share_amounts[participant_id],
                paid_amount=paid_amounts[participant_id],
            )
            db.add(new_split)
