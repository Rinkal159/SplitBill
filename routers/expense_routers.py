from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from auth.authentication import get_current_user
from utils.validations_on_expense import validate
from decimal import Decimal

from schemas.expense_schema import (
    ExpenseCreate as ExpenseCreateSchema
)
from model import User

expense_router = APIRouter(prefix="/api/expenses", tags=["Expenses"])


@expense_router.post("/add")
async def add_expense_api(
    expense: ExpenseCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):

    # ^ participants validation
    participant_ids = set(expense.participants)

    # if current user is not included in participants
    if current_user.id not in participant_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be included in as a participant",
        )

    # if duplicate ids in participnats
    if len(expense.participants) != len(participant_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate IDs are not allowed",
        )

    # get all the friend ids
    friends_ids = {
        current_user.id,
        *[friend.friend_id for friend in current_user.sent_friendships],
        *[friend.user_id for friend in current_user.received_friendships],
    }

    # user is a pariticipant but not a friend
    invalid_ids = participant_ids - friends_ids
    if invalid_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot split an expense with non-friend users: {sorted(invalid_ids)}",
        )

    # ^ payments validation
    validate(
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
        validate(
            items=expense.splits,
            participant_ids=participant_ids,
            total_amount=expense.total_amount,
            item_name="split",
            value_field="amount",
        )
    elif expense.split_method == "percentage":
        validate(
            items=expense.splits,
            participant_ids=participant_ids,
            total_amount=Decimal("100"),
            item_name="split",
            value_field="percentage",
        )
        
        
    
        
    
