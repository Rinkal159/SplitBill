from utils.validate_participants import validate_participants
from utils.validations_on_expense import validate_payments_and_splits
from fastapi import  HTTPException, status
from decimal import Decimal

async def validate_fields(group_id, db, expense, participant_ids, current_user):
    # ^ participants validation
    await validate_participants(
        group_id=group_id,
        db=db,
        participants_id_raw=expense.participants,
        participant_ids_set=participant_ids,
        current_user=current_user,
    )

    # ^ payments validation
    await validate_payments_and_splits(
        group_id=group_id,
        db=db,
        items=expense.payments,
        participant_ids=participant_ids,
        total_amount=expense.total_amount,
        item_name="payment",
        value_field="amount"
    )

    # ^ splits validation
    if expense.split_method == "equal" and expense.expense_splits is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Equal splits does not require split values",
        )

    if expense.split_method in {"amount", "percentage"} and expense.expense_splits is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount and percentage splits require split values",
        )

    if expense.split_method == "amount":
        await validate_payments_and_splits(
            group_id=group_id,
            db=db,
            items=expense.expense_splits,
            participant_ids=participant_ids,
            total_amount=expense.total_amount,
            item_name="split",
            value_field="amount",
        )
    elif expense.split_method == "percentage":
        await validate_payments_and_splits(
            group_id=group_id,
            db=db,
            items=expense.expense_splits,
            participant_ids=participant_ids,
            total_amount=Decimal("100"),
            item_name="split",
            value_field="percentage",
        )