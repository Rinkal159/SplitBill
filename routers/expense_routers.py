from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from auth.authentication import get_current_user
from utils.validations_on_expense import validate
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import selectinload
from utils.dynamic_append import append_in_logs

from schemas.expense_schema import (
    ExpenseCreate as ExpenseCreateSchema,
    ExpensesResponse as ExpenseResponseSchema,
    BorrowingsAndLendings as BorrowingsAndLendingsSchema
)
from model import Expense, Splits

expense_router = APIRouter(prefix="/api/expenses", tags=["Expenses"])


# * add an expense
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

    new_expense = Expense(
        title=expense.title,
        description=expense.description,
        note=expense.note,
        total_amount=expense.total_amount,
        expense_date=expense.expense_date,
        created_by=current_user.id,
    )
    db.add(new_expense)

    await db.flush()

    # each participant should pay
    if expense.split_method == "equal":
        share = (expense.total_amount / Decimal(len(participant_ids))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        share_amounts = {user_id: share for user_id in participant_ids}

    elif expense.split_method == "amount":
        share_amounts = {
            split.user_id: split.amount for split in expense.splits  # type: ignore
        }

    else:
        share_amounts = {
            split.user_id: expense.total_amount * split.percentage / Decimal("100")  # type: ignore
            for split in expense.splits  # type: ignore
        }

    # each participant actually paid
    paid_amounts = {payment.user_id: payment.amount for payment in expense.payments}

    for participant_id in participant_ids:
        new_split = Splits(
            expense_id=new_expense.id,
            user_id=participant_id,
            share_amount=share_amounts[participant_id],
            paid_amount=paid_amounts[participant_id],
        )
        db.add(new_split)

    await db.commit()

    return {"message": "Added an expense successfully!"}


# * get all expenses in which you're invloved
@expense_router.get("/", response_model=ExpenseResponseSchema)
async def get_all_expenses(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):

    # get all expenses in which you're involved
    result = await db.execute(
        select(Splits.expense_id)
        .where(Splits.user_id == current_user.id)
        .order_by(Splits.expense_id)
    )
    existed_expenses = result.scalars().all()

    transactions = []

    for expense_id in existed_expenses:

        # get the splits of every expense
        result = await db.execute(
            select(Splits)
            .options(selectinload(Splits.user))
            .where(Splits.expense_id == expense_id)
            .order_by(Splits.expense_id)
        )
        splits = result.scalars().all()

        creditors = []
        debtors = []

        for split in splits:
            balance = split.paid_amount - split.share_amount
            if balance > 0:
                creditors.append({"user": split.user, "balance": balance})
            elif balance < 0:
                debtors.append({"user": split.user, "balance": balance})

        i = 0  # creditor
        j = 0  # debtor

        your_owes = []
        your_owed = []
        other_logs = []

        while i < len(creditors) and j < len(debtors):
            creditor = creditors[i]
            debtor = debtors[j]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)


            # if you're creditor then you're owed to other participants (Paisa lena h)
            if creditor["user"].id == current_user.id:
                append_in_logs(
                    logs=your_owed,
                    user=current_user,
                    owe_d="owed",
                    owe_dValue=transfer,
                    to={
                        "id": debtor["user"].id,
                        "name": debtor["user"].name,
                        "profile_picture": debtor["user"].profile_picture,
                    },
                )


            # if you're debtor then you owed to other participants (Paisa dena h)
            elif debtor["user"].id == current_user.id:
                append_in_logs(
                    logs=your_owes,
                    user=current_user,
                    owe_d="owes",
                    owe_dValue=transfer,
                    to={
                        "id": creditor["user"].id,
                        "name": creditor["user"].name,
                        "profile_picture": creditor["user"].profile_picture,
                    },
                )
                
            
            # other participnat
            else:
                append_in_logs(
                    logs=other_logs,
                    user={
                        "id": debtor["user"].id,
                        "name": debtor["user"].name,
                        "profile_picture": debtor["user"].profile_picture,
                    },
                    owe_d="owes",
                    owe_dValue=transfer,
                    to={
                        "id": creditor["user"].id,
                        "name": creditor["user"].name,
                        "profile_picture": creditor["user"].profile_picture,
                    },
                )

            creditor["balance"] -= transfer
            debtor["balance"] += transfer

            if creditor["balance"] == 0:
                i += 1

            if debtor["balance"] == 0:
                j += 1

        result = await db.execute(select(Expense).where(Expense.id == expense_id))
        transactions.append(
            {
                "expense": result.scalars().one_or_none(),
                "your_borrowings": your_owes,
                "your_lentings": your_owed,
                "other_transactions": other_logs,
            }
        )

    return {"expenses": transactions}


#* get all your borrowings and lendings
@expense_router.get("/you", response_model=BorrowingsAndLendingsSchema)
async def get_all_borrowing_lentings_api(db: AsyncSession=Depends(get_db), current_user=Depends(get_current_user)):
    # get all expenses in which you're involved
    result = await db.execute(
        select(Splits.expense_id)
        .where(Splits.user_id == current_user.id)
        .order_by(Splits.expense_id)
    )
    existed_expenses = result.scalars().all()
    
    general_balance = {}
    
    
    for expense_id in existed_expenses:
        result = await db.execute(select(Splits).options(selectinload(Splits.user)).where(Splits.expense_id == expense_id))
        splits = result.scalars().all()
        
        creditors = []
        debtors = []
        
        for split in splits:
            balance = split.paid_amount - split.share_amount
            if balance > 0:
                creditors.append({"user" : split.user, "balance" : balance})
            elif balance < 0:
                debtors.append({"user" : split.user, "balance" : balance})
    
        
        i = 0  # creditor
        j = 0  # debtor

        while i < len(creditors) and j < len(debtors):
            creditor = creditors[i]
            debtor = debtors[j]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)


            # if you're creditor then you "lent" to other participants (Paisa diya)
            if creditor["user"].id == current_user.id:
                debtor_id = debtor["user"]
                existed_debtor = general_balance.get(debtor_id.id)
                
                general_balance[debtor_id.id] = {
                    "user" : {
                        "id": debtor_id.id,
                        "name" : debtor_id.name,
                        "profile_picture" : debtor_id.profile_picture
                    },
                    "amount" : existed_debtor["amount"] + transfer if existed_debtor else transfer
                }


            # if you're debtor then you "borrowed" from other participants (Paisa liya)
            elif debtor["user"].id == current_user.id:
                creditor_id = creditor["user"]
                existed_creditor = general_balance.get(creditor_id.id)
                general_balance[creditor_id.id] = {
                    "user" : {
                        "id":creditor_id.id,
                        "name" : creditor_id.name,
                        "profile_picture" : creditor_id.profile_picture
                    },
                    "amount" : existed_creditor["amount"] - transfer if existed_creditor else -transfer
                }
                

            creditor["balance"] -= transfer
            debtor["balance"] += transfer

            if creditor["balance"] == 0:
                i += 1

            if debtor["balance"] == 0:
                j += 1
    
    
    borrowings = []
    lendings = []
    total_borrowings = Decimal("0")
    total_lendings = Decimal("0")
    
    for curr in general_balance.values():
        if curr.get("amount") == 0:
            continue
        
        if curr.get("amount") < 0:
            total_borrowings += abs(curr.get("amount"))
            borrowings.append({
                "amount" : abs(curr.get("amount")),
                "borrowed_from" : curr.get("user")
            })
        else:
            total_lendings += curr.get("amount")
            lendings.append({
                "amount" : curr.get("amount"),
                "lent_to" : curr.get("user")
            })
    
    return {"total_borrowings":total_borrowings, "total_lendings" :total_lendings, "borrowings" : borrowings, "lendings" : lendings}
     