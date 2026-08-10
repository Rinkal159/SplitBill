from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Response,
    UploadFile,
    File,
    Query,
)
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend_splitbill.database import get_db
from backend_splitbill.auth.authentication import get_current_user
from decimal import Decimal
from backend_splitbill.utils.get_creditors_debtors import get_creditors_debtors
from backend_splitbill.utils.get_expense_groups import get_expense_groups
from backend_splitbill.utils.validate_fields import validate_fields
from backend_splitbill.utils.create_splits_of_expense import create_expense_splits
from backend_splitbill.utils.get_settlement_groups import get_settlement_groups
from backend_splitbill.utils.get_all_expenses_in_which_user_involved import (
    get_all_expenses_in_which_user_involved,
)
from backend_splitbill.utils.friendship_checks import friendship_checks
from backend_splitbill.services.cloudinary import (
    upload_picture_on_cloudinary,
    delete_picture_from_cloudinary,
)
from typing import Annotated

from backend_splitbill.schemas.expense_schema import (
    ExpenseCreate as ExpenseCreateSchema,
    ExpenseCreateResponse as ExpenseCreateResponseSchema,
    ExpenseSchema as SingleExpenseResponseSchema,
    PaginatedExpensesResponse as PaginatedExpensesResponseSchema,
    BorrowingsAndLendings as BorrowingsAndLendingsSchema,
    FriendsSettlementsResponse as FriendsSettlementsResponseSchema,
    UserDetail as UserDetailSchema,
)
from backend_splitbill.model import (
    Expense,
    ExpenseSplits,
    ExpenseHistory,
    ExpenseHistoryAction,
    GroupMember,
    Group,
)

expense_router = APIRouter(prefix="/api/expenses", tags=["Expenses"])


# * add an expense
@expense_router.post("/", response_model=ExpenseCreateResponseSchema)
async def add_expense_api(
    expense: ExpenseCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):

    participant_ids = set(expense.participants)

    # if it is a group expense
    if expense.group_id:

        # if group doesn't exist
        result = await db.execute(select(Group).where(Group.id == expense.group_id))
        existed_group = result.scalars().one_or_none()

        if not existed_group:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Group not found")

    # validate participnats, payments and splits
    await validate_fields(expense.group_id, db, expense, participant_ids, current_user)

    # creating new expense
    new_expense = Expense(
        group_id=expense.group_id,
        title=expense.title,
        description=expense.description,
        note=expense.note,
        total_amount=expense.total_amount,
        expense_date=expense.expense_date,
        created_by=current_user.id,
    )
    db.add(new_expense)
    await db.flush()

    # creating expense history
    new_expense_history = ExpenseHistory(
        expense_id=new_expense.id,
        group_id=new_expense.group_id,
        expense_title=new_expense.title,
        expense_description=new_expense.description,
        expense_total_amount=new_expense.total_amount,
        expense_expense_date=new_expense.expense_date,
        action=ExpenseHistoryAction.CREATED,
        performed_by=current_user.id,
    )
    db.add(new_expense_history)

    try:
        # creating splits of that expense
        await create_expense_splits(
            db=db,
            expense=expense,
            participant_ids=participant_ids,
            expense_data=new_expense,
        )

        await db.commit()
        await db.refresh(new_expense)

    except Exception:
        await db.rollback()
        raise

    return new_expense


# * upload attachment (receipt) of the expense
@expense_router.post(
    "/{expense_id}/attachment", response_model=ExpenseCreateResponseSchema
)
async def upload_receipt_api(
    expense_id: int,
    attachment: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        # expense not exist
        result = await db.execute(select(Expense).where(Expense.id == expense_id))
        existed_expense = result.scalars().one_or_none()

        if not existed_expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found"
            )

        # you're not a participant of that expense
        result = await db.execute(
            select(ExpenseSplits).where(
                ExpenseSplits.expense_id == expense_id,
                ExpenseSplits.user_id == current_user.id,
            )
        )
        existed_participant = result.scalars().one_or_none()

        if not existed_participant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to upload attachments",
            )

        # attachment already uploaded
        if existed_expense.attachment:
            delete_picture_from_cloudinary(existed_expense.attachment)

        # storing attachment in database (in expense table)
        if attachment:
            if attachment.filename:
                attachment_public_id = upload_picture_on_cloudinary(
                    file=attachment, folder="expense_attachments"
                )
                existed_expense.attachment = attachment_public_id

        await db.commit()
        await db.refresh(existed_expense)
    except:
        await db.rollback()
        raise

    return existed_expense


# * get single expense
@expense_router.get("/{expense_id}", response_model=SingleExpenseResponseSchema)
async def get_single_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # expense not exist
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    existed_expense = result.scalars().one_or_none()

    if not existed_expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found"
        )

    # you're not involved in that expense
    result = await db.execute(
        select(ExpenseSplits).where(
            ExpenseSplits.expense_id == expense_id,
            ExpenseSplits.user_id == current_user.id,
        )
    )
    existed_expense_split = result.scalars().one_or_none()

    if not existed_expense_split:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not involved in this expense",
        )

    # get settlements for this expense
    settlements = await get_all_expenses_in_which_user_involved(
        expense_ids=[expense_id], db=db, current_user=current_user
    )

    return {"expenses": settlements}


# * get all expenses in which you're involved - All expenses - PAGINATED
@expense_router.get("/", response_model=PaginatedExpensesResponseSchema)
async def get_all_expenses_api(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    page: int = 1,
    limit: Annotated[int, Query(gt=0, lt=100)] = 10,
):
    skip = limit * (page - 1)

    result = await db.execute(
        select(func.count(func.distinct(ExpenseSplits.expense_id))).where(
            ExpenseSplits.user_id == current_user.id
        )
    )
    total_count = result.scalar_one()

    # get all expenses in which you're involved
    result = await db.execute(
        select(ExpenseSplits.expense_id)
        .where(ExpenseSplits.user_id == current_user.id)
        .distinct()
        .offset(skip)
        .limit(limit)
    )
    expense_ids = result.scalars().all()

    expenses = await get_all_expenses_in_which_user_involved(
        expense_ids=expense_ids, db=db, current_user=current_user
    )

    return {
        "expenses": expenses,
        "page": page,
        "skip": skip,
        "limit": limit,
        "has_more": skip + len(expenses) < total_count,
    }


# * get all group expenses - All group expenses - PAGINATED
@expense_router.get(
    "/groups/{group_id}", response_model=PaginatedExpensesResponseSchema
)
async def get_all_group_expenses_api(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    page: int = 1,
    limit: Annotated[int, Query(gt=0, lt=100)] = 10,
):

    # group doesn't exist
    result = await db.execute(
        select(Group).where(Group.id == group_id, Group.is_deleted.is_(False))
    )
    existed_group = result.scalars().one_or_none()

    if not existed_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )

    # you're not a member of that group
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id, GroupMember.user_id == current_user.id
        )
    )
    existed_group_member = result.scalars().one_or_none()

    if not existed_group_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not a member of this group",
        )

    skip = limit * (page - 1)

    # get the total count of group expenses
    result = await db.execute(
        select(func.count(func.distinct(Expense.id))).where(
            Expense.group_id == group_id
        )
    )
    total_count = result.scalar_one()

    # get paginated group expenses ids
    result = await db.execute(
        select(Expense.id)
        .where(Expense.group_id == group_id)
        .distinct()
        .offset(skip)
        .limit(limit)
    )
    expense_ids = result.scalars().all()

    expenses = await get_all_expenses_in_which_user_involved(
        expense_ids=expense_ids, db=db, current_user=current_user
    )

    return {
        "expenses": expenses,
        "page": page,
        "skip": skip,
        "limit": limit,
        "has_more": skip + len(expenses) < total_count,
    }


# * get all your borrowings and lendings - Dashboard
@expense_router.get("/me", response_model=BorrowingsAndLendingsSchema)
async def get_all_borrowing_and_lendings_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    # get all expenses in which you're involved
    result = await db.execute(
        select(ExpenseSplits.expense_id)
        .where(ExpenseSplits.user_id == current_user.id)
        .order_by(ExpenseSplits.expense_id)
    )
    expense_ids = result.scalars().all()

    expense_groups = await get_expense_groups(
        expense_ids=expense_ids, db=db, newest_first=True
    )

    general_balance = {}

    for splits in expense_groups:
        settlement_groups = await get_settlement_groups(splits, db)

        creditors = []
        debtors = []
        get_creditors_debtors(splits, creditors, debtors, settlement_groups)

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
                    "user": UserDetailSchema.model_validate(debtor["user"]),
                    "amount": (
                        existed_debtor["amount"] + transfer
                        if existed_debtor
                        else transfer
                    ),
                }

            # if you're debtor then you "borrowed" from other participants (Paisa liya)
            elif debtor["user"].id == current_user.id:
                creditor_id = creditor["user"]
                existed_creditor = general_balance.get(creditor_id.id)
                general_balance[creditor_id.id] = {
                    "user": UserDetailSchema.model_validate(creditor["user"]),
                    "amount": (
                        existed_creditor["amount"] - transfer
                        if existed_creditor
                        else -transfer
                    ),
                }

            creditor["balance"] -= transfer
            debtor["balance"] += transfer

            if creditor["balance"] <= Decimal("0"):
                i += 1

            if abs(debtor["balance"]) <= Decimal("0"):
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
            borrowings.append(
                {"borrowed_from": curr.get("user"), "amount": abs(curr.get("amount"))}
            )
        else:
            total_lendings += curr.get("amount")
            lendings.append({"lent_to": curr.get("user"), "amount": curr.get("amount")})

    return {
        "total_borrowings": total_borrowings,
        "total_lendings": total_lendings,
        "borrowings": borrowings,
        "lendings": lendings,
    }


# * get all expenses in which you and your friend is involved - Friends
@expense_router.get(
    "/friends/{friend_id}", response_model=FriendsSettlementsResponseSchema
)
async def get_friends_settlements_api(
    friend_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # friend settlement data
    response = await friendship_checks(
        db=db, current_user=current_user, friend_id=friend_id
    )
    return response["friend_settlement_data"]


# * delete an expense
@expense_router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense_api(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # expense doesn't exist
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    existed_expense = result.scalars().one_or_none()
    if not existed_expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found"
        )

    # you're not the creator of expense
    if existed_expense.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not authorized to perform requested action",
        )

    # creating expense history
    new_expense_history = ExpenseHistory(
        expense_id=expense_id,
        group_id=existed_expense.group_id,
        expense_title=existed_expense.title,
        expense_description=existed_expense.description,
        expense_total_amount=existed_expense.total_amount,
        expense_expense_date=existed_expense.expense_date,
        action=ExpenseHistoryAction.DELETED,
        performed_by=current_user.id,
    )
    db.add(new_expense_history)

    await db.delete(existed_expense)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# * update an expense
@expense_router.put("/{expense_id}", response_model=ExpenseCreateResponseSchema)
async def update_expense_api(
    expense_id: int,
    expense: ExpenseCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # expense doesn't exist
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    existed_expense = result.scalars().one_or_none()
    if not existed_expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found"
        )

    # you're not the creator of expense
    if existed_expense.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not authorized to perform requested action",
        )

    # if it is a group expense
    if expense.group_id:

        # if group doesn't exist
        result = await db.execute(select(Group).where(Group.id == expense.group_id))
        existed_group = result.scalars().one_or_none()

        if not existed_group:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Group not found")

    participant_ids = set(expense.participants)

    # validate participnats, payments and splits
    await validate_fields(expense.group_id, db, expense, participant_ids, current_user)

    # updating expense
    existed_expense.title = expense.title
    existed_expense.description = expense.description  # type: ignore[call-args]
    existed_expense.note = expense.note  # type: ignore[call-args]
    existed_expense.total_amount = expense.total_amount
    existed_expense.expense_date = expense.expense_date

    # creating expense history
    new_expense_history = ExpenseHistory(
        expense_id=existed_expense.id,
        group_id=existed_expense.group_id,
        expense_title=existed_expense.title,
        expense_description=existed_expense.description,
        expense_total_amount=existed_expense.total_amount,
        expense_expense_date=existed_expense.expense_date,
        action=ExpenseHistoryAction.UPDATED,
        performed_by=current_user.id,
    )
    db.add(new_expense_history)

    try:
        # deleting previous splits of that expense
        await db.execute(
            delete(ExpenseSplits).where(ExpenseSplits.expense_id == expense_id)
        )

        # creating new splits
        await create_expense_splits(
            db=db,
            expense=expense,
            participant_ids=participant_ids,
            expense_data=existed_expense,
        )

        await db.commit()
        await db.refresh(existed_expense)

    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error spliting expense",
        )

    return existed_expense
