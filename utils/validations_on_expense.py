from fastapi import HTTPException, status
from decimal import Decimal


def validate(
    participant_ids: set[int],
    items,
    total_amount: Decimal,
    item_name: str,
    value_field: str,
):

    # duplicate payments from same user_id
    user_ids = [item.user_id for item in items]
    if len(user_ids) != len(set(user_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Duplicate {item_name}s are not allowed",
        )

    # if any participants payment entry is missing
    if set(user_ids) != participant_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Each participant must have exactly one {item_name} entry",
        )

    # payment amount is less than 0
    for item in items:
        if getattr(item, value_field) < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{item_name} cannot be less than 0",
            )

    # payment amount is not equals to total amount
    total_value = sum(getattr(item, value_field) for item in items)
    if total_amount != total_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Total sum of {item_name}s should be equals to total amount",
        )
