from utils.validate_participants import validate_participants
from utils.validations_on_expense import validate_payments_and_splits
from fastapi import  HTTPException, status
from decimal import Decimal

def validate_fields(expense, participant_ids, current_user):
    # ^ participants validation
    validate_participants(
        participants_id_raw=expense.participants,
        participant_ids_set=participant_ids,
        current_user=current_user,
    )

    # ^ payments validation
    validate_payments_and_splits(
        items=expense.payments,
        participant_ids=participant_ids,
        total_amount=expense.total_amount,
        item_name="payment",
        value_field="amount",
    )

    # ^ splits validation
    if expense.split_method == "equal" and expense.splits is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Equal splits does not require split values",
        )

    if expense.split_method in {"amount", "percentage"} and expense.splits is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount and percentage splits require split values",
        )

    if expense.split_method == "amount":
        validate_payments_and_splits(
            items=expense.splits,
            participant_ids=participant_ids,
            total_amount=expense.total_amount,
            item_name="split",
            value_field="amount",
        )
    elif expense.split_method == "percentage":
        validate_payments_and_splits(
            items=expense.splits,
            participant_ids=participant_ids,
            total_amount=Decimal("100"),
            item_name="split",
            value_field="percentage",
        )