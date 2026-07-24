from fastapi import HTTPException, status
from decimal import Decimal
from model import GroupMember
from sqlalchemy import select
from utils.validate_participants_are_group_members import are_group_members


async def validate_payments_and_splits(
    group_id,
    db,
    items,
    participant_ids: set[int],
    total_amount: Decimal,
    item_name: str,
    value_field: str
):
    user_ids = [item.user_id for item in items]
    
    # if it is a group expense, then check all the payers of expense and splits users are members of the group
    if group_id is not None:
        await are_group_members(db, group_id, user_ids)
    
    # duplicate payments from same user_id
    if len(user_ids) != len(set(user_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Duplicate {item_name}s are not allowed",
        )

    # if any participants payment entry is missing
    if set(user_ids) != participant_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Each participant should have one {item_name} entry",
        )

    # payment amount is less than 0
    for item in items:
        if getattr(item, value_field) is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Please provide '{value_field}' in '{item_name}'",
            )

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
