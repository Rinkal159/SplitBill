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
from datetime import date
from sqlalchemy import select, delete, func, or_, and_, case
from sqlalchemy.ext.asyncio import AsyncSession
from backend_splitbill.database import get_db
from backend_splitbill.auth.authentication import get_current_user
from decimal import Decimal
from collections import defaultdict
from backend_splitbill.utils.get_creditors_debtors import get_creditors_debtors
from backend_splitbill.utils.get_expense_groups import get_expense_groups
from backend_splitbill.utils.validate_fields import validate_fields
from backend_splitbill.utils.create_splits_of_expense import create_expense_splits
from backend_splitbill.utils.get_settlement_groups import get_settlement_groups
from backend_splitbill.utils.get_all_expenses_in_which_user_involved import (
    get_all_expenses_in_which_user_involved,
)
from backend_splitbill.services.cloudinary import (
    upload_picture_on_cloudinary,
    delete_picture_from_cloudinary,
)
from backend_splitbill.utils.get_friend_ids import get_friend_ids
from typing import Annotated
from backend_splitbill.utils.is_your_friend import is_your_friend
from backend_splitbill.utils.get_expenses_with_friend import get_expenses_with_friend
from backend_splitbill.utils.get_friend_settlement_data import (
    get_friend_settlement_data,
)

from backend_splitbill.schemas.expense_schema import (
    ExpenseCreate as ExpenseCreateSchema,
    ExpenseCreateResponse as ExpenseCreateResponseSchema,
    SingleExpenseResponse as SingleExpenseResponseSchema,
    PaginatedExpensesResponse as PaginatedExpensesResponseSchema,
    BorrowingsAndLendings as BorrowingsAndLendingsSchema,
    FriendsSettlementsResponse as FriendsSettlementsResponseSchema,
    UserDetail as UserDetailSchema,
    TotalBalanceWithFriend as TotalBalanceWithFriendSchema,
)
from backend_splitbill.schemas.group_schema import GroupDebt as GroupDebtSchema
from backend_splitbill.schemas.pagination_schema import PaginatedResponse
from backend_splitbill.model import (
    User,
    Expense,
    ExpenseSplits,
    ExpenseHistory,
    ExpenseHistoryAction,
    GroupMember,
    Group,
    Settlement,
    SettlementStatus,
)

expense_router = APIRouter(prefix="/api/expenses", tags=["Expenses"])


@expense_router.get("/groups/{group_id:int}/settlement-balances")
async def get_group_settlement_balances(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = await db.scalar(
        select(Group).where(Group.id == group_id, Group.is_deleted.is_(False))
    )
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )

    member = await db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not a member of this group",
        )

    expense_ids = (
        await db.scalars(select(Expense.id).where(Expense.group_id == group_id))
    ).all()
    expense_groups = await get_expense_groups(expense_ids, db, newest_first=True)
    all_splits = [split for splits in expense_groups for split in splits]
    settlement_groups = await get_settlement_groups(all_splits, db)

    friend_balances: dict[int, Decimal] = {}
    for splits in expense_groups:
        creditors: dict = {}
        debtors: dict = {}
        get_creditors_debtors(splits, creditors, debtors, settlement_groups)
        creditor_ids = list(creditors)
        debtor_ids = list(debtors)
        i = j = 0
        while i < len(creditor_ids) and j < len(debtor_ids):
            creditor = creditors[creditor_ids[i]]
            debtor = debtors[debtor_ids[j]]
            transfer = min(creditor["balance"], abs(debtor["balance"]))

            if creditor["user"].id == current_user.id:
                other_id = debtor["user"].id
                friend_balances[other_id] = (
                    friend_balances.get(other_id, Decimal("0")) + transfer
                )
            elif debtor["user"].id == current_user.id:
                other_id = creditor["user"].id
                friend_balances[other_id] = (
                    friend_balances.get(other_id, Decimal("0")) - transfer
                )

            creditor["balance"] -= transfer
            debtor["balance"] += transfer
            if creditor["balance"] <= 0:
                i += 1
            if debtor["balance"] >= 0:
                j += 1

    return {"friend_balances": friend_balances}


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
        category=expense.category,
        note=expense.note,
        total_amount=expense.total_amount,
        split_method=expense.split_method,
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
        expense_description=None,
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
    all_splits = [split for splits in expense_groups for split in splits]
    settlement_groups = await get_settlement_groups(all_splits, db)

    general_balance = {}
    borrowings = {}
    lendings = {}
    total_borrowings = Decimal("0")
    total_lendings = Decimal("0")

    def update_balance(user, delta):
        nonlocal total_borrowings, total_lendings

        user_id = user.id
        previous = general_balance.get(user_id, Decimal("0"))
        current = previous + delta

        if previous < 0:
            total_borrowings -= abs(previous)
            borrowings.pop(user_id, None)
        elif previous > 0:
            total_lendings -= previous
            lendings.pop(user_id, None)

        general_balance[user_id] = current
        if current < 0:
            amount = abs(current)
            total_borrowings += amount
            borrowings[user_id] = {
                "borrowed_from": UserDetailSchema.model_validate(user),
                "amount": amount,
            }
        elif current > 0:
            total_lendings += current
            lendings[user_id] = {
                "lent_to": UserDetailSchema.model_validate(user),
                "amount": current,
            }

    for splits in expense_groups:
        creditors = {}
        debtors = {}
        _, _ = get_creditors_debtors(splits, creditors, debtors, settlement_groups)

        creditor_ids = list(creditors)
        debtor_ids = list(debtors)

        i = 0  # creditor
        j = 0  # debtor

        while i < len(creditors) and j < len(debtors):
            creditor_id = creditor_ids[i]
            debtor_id = debtor_ids[j]

            creditor = creditors[creditor_id]
            debtor = debtors[debtor_id]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)

            # if you're creditor then you "lent" to other participants (Paisa diya)
            if creditor["user"].id == current_user.id:
                update_balance(debtor["user"], transfer)

            # if you're debtor then you "borrowed" from other participants (Paisa liya)
            elif debtor["user"].id == current_user.id:
                update_balance(creditor["user"], -transfer)

            creditor["balance"] -= transfer
            debtor["balance"] += transfer

            if creditor["balance"] <= Decimal("0"):
                i += 1

            if abs(debtor["balance"]) <= Decimal("0"):
                j += 1

    return {
        "total_borrowings": total_borrowings,
        "total_lendings": total_lendings,
        "borrowings": list(borrowings.values()),
        "lendings": list(lendings.values()),
    }


# * get all the people from you borrowed with borrowed money
@expense_router.get("/borrowings")
async def get_borrowings_api(
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

    general_balance = []


# * get single expense
@expense_router.get("/edit/{expense_id}")
async def get_expense_for_edit(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    expense_result = await db.execute(
        select(
            Expense.id,
            Expense.group_id,
            Expense.title,
            Expense.category,
            Expense.note,
            Expense.total_amount,
            Expense.expense_date,
            Expense.split_method,
            Expense.created_by,
            Group.name.label("group_name"),
        )
        .outerjoin(Group, Group.id == Expense.group_id)
        .where(Expense.id == expense_id)
    )
    expense = expense_result.mappings().one_or_none()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found"
        )
    if expense["created_by"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not authorized to edit this expense",
        )

    splits_result = await db.execute(
        select(
            ExpenseSplits.user_id,
            User.name,
            ExpenseSplits.paid_amount,
            ExpenseSplits.split_value,
        )
        .join(User, User.id == ExpenseSplits.user_id)
        .where(ExpenseSplits.expense_id == expense_id)
        .order_by(ExpenseSplits.user_id)
    )
    group = (
        {"id": expense["group_id"], "name": expense["group_name"]}
        if expense["group_id"] is not None
        else None
    )
    return {
        "id": expense["id"],
        "group": group,
        "title": expense["title"],
        "category": expense["category"],
        "note": expense["note"],
        "total_amount": expense["total_amount"],
        "expense_date": expense["expense_date"],
        "split_method": expense["split_method"],
        "expense_splits": [
            {
                "user": {"id": split.user_id, "name": split.name},
                "paid_amount": split.paid_amount,
                "split_value": split.split_value,
            }
            for split in splits_result
        ],
    }


# * get total expenses and total settlements
@expense_router.get("/total")
async def get_total_expenses_and_settlements_api(
    start_date: date = Query(...),
    end_date: date = Query(...),
    group_id: int | None = Query(default=None, gt=0),
    friend_id: int | None = Query(default=None, gt=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if group_id is not None and friend_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Choose either group_id or friend_id",
        )
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be on or after start_date",
        )

    expense_scope = [
        Expense.expense_date >= start_date,
        Expense.expense_date <= end_date,
        select(ExpenseSplits.id)
        .where(
            ExpenseSplits.expense_id == Expense.id,
            ExpenseSplits.user_id == current_user.id,
        )
        .correlate(Expense)
        .exists(),
    ]

    if group_id is not None:
        is_member = await db.scalar(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == current_user.id,
            )
        )
        if is_member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )
        expense_scope.append(Expense.group_id == group_id)
    elif friend_id is not None:
        if friend_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="friend_id must refer to another user",
            )
        friend_in_expense = (
            select(ExpenseSplits.id)
            .where(
                ExpenseSplits.expense_id == Expense.id,
                ExpenseSplits.user_id == friend_id,
            )
            .correlate(Expense)
            .exists()
        )
        expense_scope.append(friend_in_expense)

    # total expenses
    matching_expenses = (
        select(Expense.id, Expense.total_amount).where(*expense_scope).subquery()
    )

    total_query = select(func.coalesce(func.sum(matching_expenses.c.total_amount), 0))
    total_expenses = (await db.execute(total_query)).scalar_one()

    # shares, payings, and remaining debt after settlement allocations
    splits_query = select(
        func.coalesce(func.sum(ExpenseSplits.share_amount), 0).label("total_share"),
        func.coalesce(func.sum(ExpenseSplits.paid_amount), 0).label("total_paid"),
    ).where(
        ExpenseSplits.expense_id.in_(select(matching_expenses.c.id)),
        ExpenseSplits.user_id == current_user.id,
    )

    splits_result = await db.execute(splits_query)
    total_share, total_paid = splits_result.one()

    period_expense_ids = (
        (await db.execute(select(matching_expenses.c.id))).scalars().all()
    )
    expense_groups = await get_expense_groups(
        expense_ids=period_expense_ids,
        db=db,
        newest_first=True,
    )
    all_splits = [split for splits in expense_groups for split in splits]
    settlement_groups = await get_settlement_groups(
        all_splits,
        db,
    )

    total_balance = Decimal("0")

    if friend_id is not None:
        friend_summary = await get_friend_settlement_data(
            friend_id=friend_id,
            db=db,
            current_user=current_user,
            expense_ids={"expense_ids": period_expense_ids},
            include_expense_summary=False,
        )
        friend_balance = friend_summary["friend_balances"].get(friend_id, Decimal("0"))
        total_borrowings = max(-friend_balance, Decimal("0"))
        total_lendings = max(friend_balance, Decimal("0"))
        total_balance = friend_summary["total_balance"]
    else:
        balances_by_user = defaultdict(lambda: Decimal("0"))
        for splits in expense_groups:
            creditors = {}
            debtors = {}
            get_creditors_debtors(splits, creditors, debtors, settlement_groups)
            creditor_ids = list(creditors)
            debtor_ids = list(debtors)
            creditor_index = 0
            debtor_index = 0

            while creditor_index < len(creditor_ids) and debtor_index < len(debtor_ids):
                creditor = creditors[creditor_ids[creditor_index]]
                debtor = debtors[debtor_ids[debtor_index]]
                transfer = min(creditor["balance"], abs(debtor["balance"]))

                if creditor["user"].id == current_user.id:
                    balances_by_user[debtor["user"].id] += transfer
                    total_balance += transfer
                elif debtor["user"].id == current_user.id:
                    balances_by_user[creditor["user"].id] -= transfer
                    total_balance -= transfer

                creditor["balance"] -= transfer
                debtor["balance"] += transfer
                if creditor["balance"] <= 0:
                    creditor_index += 1
                if debtor["balance"] >= 0:
                    debtor_index += 1

        total_borrowings = sum(
            (-balance for balance in balances_by_user.values() if balance < 0),
            Decimal("0"),
        )
        total_lendings = sum(
            (balance for balance in balances_by_user.values() if balance > 0),
            Decimal("0"),
        )

    # category wise spendings
    category_query = (
        select(
            Expense.category.label("category"),
            func.coalesce(func.sum(ExpenseSplits.share_amount), 0).label("amount"),
        )
        .join(ExpenseSplits, ExpenseSplits.expense_id == Expense.id)
        .where(
            ExpenseSplits.user_id == current_user.id,
            *expense_scope,
        )
        .group_by(Expense.category)
        .order_by(func.sum(ExpenseSplits.share_amount).desc())
    )

    category_result = await db.execute(category_query)
    rows = category_result.all()

    category_total = sum((row.amount for row in rows), start=Decimal("0"))

    categories = [
        {
            "category": row.category,
            "amount": row.amount,
            "percentage": (
                round((row.amount / category_total) * 100, 2) if category_total else 0
            ),
        }
        for row in rows
    ]

    return {
        "total_expenses": total_expenses,
        "your_shares": total_share,
        "your_payings": total_paid,
        "total_borrowings": total_borrowings,
        "total_lendings": total_lendings,
        "total_balance": total_balance,
        "categories": categories,
    }


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
    expenses, _, _ = await get_all_expenses_in_which_user_involved(
        expense_ids=[expense_id], db=db, current_user=current_user
    )

    return {"expenses": expenses}


# * get all expenses in which you're involved - All expenses - PAGINATED
@expense_router.get("/", response_model=PaginatedExpensesResponseSchema)
async def get_all_expenses_api(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    page: Annotated[int, Query(ge=1)] = 1,
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
        .order_by(ExpenseSplits.expense_id.desc())
        .offset(skip)
        .limit(limit)
    )
    expense_ids = result.scalars().all()

    expenses, friend_balances, total_balance = (
        await get_all_expenses_in_which_user_involved(
            expense_ids=expense_ids, db=db, current_user=current_user
        )
    )

    return {
        "expenses": expenses,
        "friend_balances": friend_balances,
        "total_balance": total_balance,
        "page": page,
        "skip": skip,
        "limit": limit,
        "has_more": skip + len(expenses) < total_count,
    }


# * get all expenses of the group - All group expenses - PAGINATED
@expense_router.get(
    "/groups/{group_id:int}", response_model=PaginatedExpensesResponseSchema
)
async def get_all_group_expenses_api(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    page: Annotated[int, Query(ge=1)] = 1,
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
        .order_by(Expense.id.desc())
        .offset(skip)
        .limit(limit)
    )
    expense_ids = result.scalars().all()

    expenses, friend_balances, total_balance = (
        await get_all_expenses_in_which_user_involved(
            expense_ids=expense_ids, db=db, current_user=current_user
        )
    )

    return {
        "expenses": expenses,
        "friend_balances": friend_balances,
        "total_balance": total_balance,
        "page": page,
        "skip": skip,
        "limit": limit,
        "has_more": skip + len(expenses) < total_count,
    }


# * get groups in which user is in debt
@expense_router.get("/groups/debt/{friend_id}", response_model=list[GroupDebtSchema])
async def get_debt_groups_api(
    friend_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # groups in which you're a member
    result = await db.execute(
        select(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(
            GroupMember.user_id == current_user.id,
            Group.is_deleted.is_(False),
        )
        .order_by(Group.name)
    )
    groups = result.scalars().unique().all()
    group_ids = [group.id for group in groups]
    if not group_ids:
        return []

    # Collect all group expenses involving the current user in one query.
    result = await db.execute(
        select(Expense.group_id, Expense.id)
        .join(ExpenseSplits, ExpenseSplits.expense_id == Expense.id)
        .where(
            Expense.group_id.in_(group_ids),
            ExpenseSplits.user_id == current_user.id,
        )
        .distinct()
    )
    expense_ids_by_group = {}
    for group_id, expense_id in result.all():
        expense_ids_by_group.setdefault(group_id, []).append(expense_id)

    expense_groups = await get_expense_groups(
        expense_ids=[item for ids in expense_ids_by_group.values() for item in ids],
        db=db,
        newest_first=True,
    )
    all_splits = [split for splits in expense_groups for split in splits]
    settlement_groups = await get_settlement_groups(all_splits, db)
    balance_by_group = {group_id: Decimal("0") for group_id in group_ids}

    for splits in expense_groups:
        group_id = splits[0].expense.group_id
        if group_id is None:
            continue
        creditors, debtors = {}, {}
        get_creditors_debtors(splits, creditors, debtors, settlement_groups)
        creditor_ids, debtor_ids = list(creditors), list(debtors)
        i = j = 0
        while i < len(creditor_ids) and j < len(debtor_ids):
            creditor = creditors[creditor_ids[i]]
            debtor = debtors[debtor_ids[j]]
            transfer = min(creditor["balance"], abs(debtor["balance"]))
            if (
                creditor["user"].id == current_user.id
                and debtor["user"].id == friend_id
            ):
                balance_by_group[group_id] += transfer
            elif (
                debtor["user"].id == current_user.id
                and creditor["user"].id == friend_id
            ):
                balance_by_group[group_id] -= transfer
            creditor["balance"] -= transfer
            debtor["balance"] += transfer
            if creditor["balance"] <= 0:
                i += 1
            if debtor["balance"] >= 0:
                j += 1

    debt_groups = [
        {"group": group, "debt_amount": abs(balance_by_group[group.id])}
        for group in groups
        if balance_by_group[group.id] < 0
    ]

    return debt_groups


# * get all expenses in which you and your friend is involved - Friends
@expense_router.get(
    "/friends/{friend_id}", response_model=FriendsSettlementsResponseSchema
)
async def get_friends_settlements_api(
    friend_id: int,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        await is_your_friend(db, current_user, friend_id)
        return await get_friend_settlement_data(
            friend_id=friend_id,
            db=db,
            current_user=current_user,
            include_expense_summary=True,
            page=page,
            limit=limit,
        )
    except HTTPException as error:
        if error.status_code != status.HTTP_403_FORBIDDEN:
            raise

    shared_expenses = await get_expenses_with_friend(db, current_user, friend_id)
    if not shared_expenses["expense_ids"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view expenses with a friend or a user who shares expenses with you",
        )
    return await get_friend_settlement_data(
        friend_id=friend_id,
        db=db,
        current_user=current_user,
        expense_ids=shared_expenses,
        include_expense_summary=True,
        page=page,
        limit=limit,
    )


# * get total balance with that friend
@expense_router.get(
    "/friends/balance/{friend_id}", response_model=TotalBalanceWithFriendSchema
)
async def getTotalBalanceWithFriend(
    friend_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):

    friend = await is_your_friend(db, current_user, friend_id)

    expense_ids = await get_expenses_with_friend(db, current_user, friend_id)

    expense_groups = await get_expense_groups(
        expense_ids=expense_ids["expenses_ids_with_your_friend"],
        db=db,
        newest_first=True,
    )

    total_balance = Decimal("0")
    had_expenses = False

    for splits in expense_groups:
        settlement_groups = await get_settlement_groups(splits, db)

        creditors = {}
        debtors = {}
        _, _ = get_creditors_debtors(splits, creditors, debtors, settlement_groups)

        creditor_ids = list(creditors)
        debtor_ids = list(debtors)

        i = 0
        j = 0

        while i < len(creditors) and j < len(debtors):
            creditor_id = creditor_ids[i]
            debtor_id = debtor_ids[j]

            creditor = creditors[creditor_id]
            debtor = debtors[debtor_id]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)

            if (
                creditor["user"].id == current_user.id
                and debtor["user"].id == friend_id
            ):
                total_balance += transfer
                had_expenses = True
            elif (
                debtor["user"].id == current_user.id
                and creditor["user"].id == friend_id
            ):
                total_balance -= transfer
                had_expenses = True

            creditor["balance"] -= transfer
            debtor["balance"] += transfer

            if creditor["balance"] <= Decimal("0"):
                i += 1
            if abs(debtor["balance"]) <= Decimal("0"):
                j += 1

    return {
        "friend": friend,
        "total_balance": total_balance,
        "had_expenses": had_expenses,
    }


# * get total balance with all friends
@expense_router.get(
    "/friends/balances/all",
    response_model=PaginatedResponse[TotalBalanceWithFriendSchema],
)
async def getTotalBalanceWithAllFriends(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    all_friend_ids = sorted(await get_friend_ids(db, current_user.id))
    total = len(all_friend_ids)
    your_friends = all_friend_ids[(page - 1) * limit : page * limit]

    if not your_friends:
        return {"items": [], "page": page, "limit": limit, "has_more": False}

    friend_expenses = select(ExpenseSplits.expense_id).where(
        ExpenseSplits.user_id.in_(your_friends)
    )
    result = await db.execute(
        select(ExpenseSplits.expense_id)
        .where(
            ExpenseSplits.user_id == current_user.id,
            ExpenseSplits.expense_id.in_(friend_expenses),
        )
        .distinct()
    )
    expense_ids = result.scalars().all()

    # Fetch friend records for the IDs collected above.
    friend_result = await db.execute(select(User).where(User.id.in_(your_friends)))
    friends_by_id = {friend.id: friend for friend in friend_result.scalars().all()}

    expense_groups = await get_expense_groups(
        expense_ids=expense_ids,
        db=db,
        newest_first=True,
    )

    balances = {
        friend_id: {
            "friend": friends_by_id[friend_id],
            "total_balance": Decimal("0"),
            "had_expenses": False,
        }
        for friend_id in your_friends
        if friend_id in friends_by_id
    }

    for splits in expense_groups:
        settlement_groups = await get_settlement_groups(splits, db)

        creditors = {}
        debtors = {}

        _, _ = get_creditors_debtors(
            splits=splits,
            settlement_groups=settlement_groups,
            creditors=creditors,
            debtors=debtors,
        )

        creditor_ids = list(creditors)
        debtor_ids = list(debtors)

        i = 0
        j = 0

        while i < len(creditors) and j < len(debtors):
            creditor_id = creditor_ids[i]
            debtor_id = debtor_ids[j]

            creditor = creditors[creditor_id]
            debtor = debtors[debtor_id]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)

            # Current user lent to a friend.
            if (
                creditor["user"].id == current_user.id
                and debtor["user"].id in your_friends
            ):
                friend_id = debtor["user"].id
                balances[friend_id]["total_balance"] += transfer
                balances[friend_id]["had_expenses"] = True

            # Current user borrowed from a friend.
            elif (
                debtor["user"].id == current_user.id
                and creditor["user"].id in your_friends
            ):
                friend_id = creditor["user"].id
                balances[friend_id]["total_balance"] -= transfer
                balances[friend_id]["had_expenses"] = True

            creditor["balance"] -= transfer
            debtor["balance"] += transfer

            if creditor["balance"] <= Decimal("0"):
                i += 1
            if abs(debtor["balance"]) <= Decimal("0"):
                j += 1

    return {
        "items": list(balances.values()),
        "page": page,
        "limit": limit,
        "has_more": page * limit < total,
    }


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

    # Expenses with outstanding balances cannot be removed.
    splits = await get_expense_groups(
        expense_ids=[expense_id], db=db, newest_first=True
    )
    if splits:
        settlement_groups = await get_settlement_groups(splits=splits[0], db=db)
        creditors, debtors = {}, {}
        get_creditors_debtors(
            splits=splits[0],
            creditors=creditors,
            debtors=debtors,
            settlement_groups=settlement_groups,
        )
        if creditors or debtors:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This expense has unsettled amounts and cannot be deleted. Settle all balances first.",
            )

    # creating expense history
    new_expense_history = ExpenseHistory(
        expense_id=expense_id,
        group_id=existed_expense.group_id,
        expense_title=existed_expense.title,
        expense_description=None,
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
    existed_expense.category = expense.category
    existed_expense.group_id = expense.group_id  # type: ignore[call-args]
    existed_expense.note = expense.note  # type: ignore[call-args]
    existed_expense.total_amount = expense.total_amount
    existed_expense.split_method = expense.split_method
    existed_expense.expense_date = expense.expense_date

    # creating expense history
    new_expense_history = ExpenseHistory(
        expense_id=existed_expense.id,
        group_id=existed_expense.group_id,
        expense_title=existed_expense.title,
        expense_description=None,
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
