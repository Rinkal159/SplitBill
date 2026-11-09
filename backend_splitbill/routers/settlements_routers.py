from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from backend_splitbill.auth.authentication import get_current_user
from backend_splitbill.database import get_db
from backend_splitbill.utils.get_expense_groups import get_expense_groups
from backend_splitbill.utils.get_friend_settlement_data import (
    get_friend_settlement_data,
)
from backend_splitbill.utils.get_member_settlement_data import (
    get_member_settlement_data,
)
from backend_splitbill.utils.get_settlement_creditors_debtors import (
    get_settlement_creditors_debtors,
)
from backend_splitbill.utils.is_your_friend import is_your_friend


from backend_splitbill.model import (
    Expense,
    ExpenseSplits,
    Settlement,
    SettlementSplits,
    SettlementStatus,
)
from backend_splitbill.schemas.settlement_schema import (
    GroupSettlementCreate as GroupSettlementCreateSchema,
    SettlementCreate as SettlementCreateSchema,
    SettlementRequestResponse as SettlementRequestResponseSchema,
    SettlementResponse as SettlementResponseSchema,
)

settlements_router = APIRouter(prefix="/api/settlements", tags=["Settlements"])


@settlements_router.post(
    "/groups",
    response_model=list[SettlementRequestResponseSchema],
    status_code=status.HTTP_201_CREATED,
)
async def create_group_settlement_requests(
    payload: GroupSettlementCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_ids = [item.to_user for item in payload.settlements]
    if current_user.id in user_ids or len(set(user_ids)) != len(user_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Choose each other group member once",
        )

    created = []
    try:
        for item in payload.settlements:
            available_debt, _ = await _get_request_scope_debt(
                from_user=current_user,
                to_user_id=item.to_user,
                expense_id=None,
                group_id=payload.group_id,
                db=db,
            )
            if available_debt <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"You do not owe user {item.to_user} in this group",
                )
            if item.amount > available_debt:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Settlement amount for user {item.to_user} exceeds the remaining debt",
                )

            settlement = Settlement(
                group_id=payload.group_id,
                from_user=current_user.id,
                to_user=item.to_user,
                amount=item.amount,
                payment_method=payload.payment_method,
                note=payload.note,
                settlement_date=payload.settlement_date,
                status=SettlementStatus.PENDING,
            )
            settlement.payer = current_user
            db.add(settlement)
            await db.flush()
            expense_groups = await _get_split_groups_for_settlement(settlement, db)
            created_splits, _ = await _allocate_settlement_splits(
                settlement, expense_groups, db
            )
            if not created_splits:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="No outstanding debt was found for a selected member",
                )
            created.append(settlement)

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return [await _get_settlement(item.id, db) for item in created]


def _settlement_query():
    return select(Settlement).options(
        selectinload(Settlement.payer),
        selectinload(Settlement.receiver),
    )


async def _get_settlement(settlement_id: int, db: AsyncSession) -> Settlement:
    result = await db.execute(_settlement_query().where(Settlement.id == settlement_id))
    settlement = result.scalars().one_or_none()
    if settlement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Settlement request not found"
        )
    return settlement


async def _pairwise_debt(splits, from_user_id: int, to_user_id: int, db) -> Decimal:
    """Return the remaining amount from this debtor to this creditor for these splits."""
    creditors = []
    debtors = []
    await get_settlement_creditors_debtors(splits, db, creditors, debtors)

    amount_owed = Decimal("0")
    creditor_index = 0
    debtor_index = 0

    while creditor_index < len(creditors) and debtor_index < len(debtors):
        creditor = creditors[creditor_index]
        debtor = debtors[debtor_index]
        transfer = min(creditor["balance"], abs(debtor["balance"]))

        if debtor["user"].id == from_user_id and creditor["user"].id == to_user_id:
            amount_owed += transfer

        creditor["balance"] -= transfer
        debtor["balance"] += transfer

        if creditor["balance"] <= 0:
            creditor_index += 1
        if debtor["balance"] >= 0:
            debtor_index += 1

    return amount_owed


async def _remaining_pairwise_debt_for_expense(
    expense_id: int, from_user_id: int, to_user_id: int, db: AsyncSession
) -> Decimal:
    expense_groups = await get_expense_groups([expense_id], db, newest_first=False)
    if not expense_groups:
        return Decimal("0")
    return await _pairwise_debt(expense_groups[0], from_user_id, to_user_id, db)


async def _get_request_scope_debt(
    *,
    from_user,
    to_user_id: int,
    expense_id: int | None,
    group_id: int | None,
    db: AsyncSession,
):
    if expense_id is not None:
        result = await db.execute(select(Expense).where(Expense.id == expense_id))
        expense = result.scalars().one_or_none()
        if expense is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found"
            )
        if group_id is not None and expense.group_id != group_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The expense does not belong to the specified group",
            )

        expense_groups = await get_expense_groups([expense_id], db, newest_first=False)
        if not expense_groups or not any(
            split.user_id in {from_user.id, to_user_id} for split in expense_groups[0]
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both users must be participants in this expense",
            )
        participants = {split.user_id for split in expense_groups[0]}
        if not {from_user.id, to_user_id}.issubset(participants):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both users must be participants in this expense",
            )
        return (
            await _pairwise_debt(expense_groups[0], from_user.id, to_user_id, db),
            expense.group_id,
        )

    if group_id is not None:
        group_data = await get_member_settlement_data(
            group_id=group_id,
            user_id=to_user_id,
            db=db,
            current_user=from_user,
        )
        total_balance = group_data["total_balance"]
        return (abs(total_balance) if total_balance < 0 else Decimal("0"), group_id)

    await is_your_friend(db, from_user, to_user_id)
    friend_data = await get_friend_settlement_data(
        friend_id=to_user_id, db=db, current_user=from_user
    )
    total_balance = friend_data["total_balance"]
    return (abs(total_balance) if total_balance < 0 else Decimal("0"), None)


async def _get_split_groups_for_settlement(settlement: Settlement, db: AsyncSession):
    if settlement.expense_id is not None:
        return await get_expense_groups(
            [settlement.expense_id], db=db, newest_first=False
        )

    payer = settlement.payer
    if settlement.group_id is not None:
        data = await get_member_settlement_data(
            group_id=settlement.group_id,
            user_id=settlement.to_user,
            db=db,
            current_user=payer,
        )
        # Apply payments to the oldest outstanding expense first (FIFO).
        return list(
            reversed(
                [
                    item["splits"]
                    for item in data["settlements"]
                    if item["net_balance"] < 0
                ]
            )
        )

    data = await get_friend_settlement_data(
        friend_id=settlement.to_user, db=db, current_user=payer
    )
    # Overall payments can cover both individual and group expenses. Allocate
    # them oldest-first so creation time breaks ties on the same expense date.
    return list(
        reversed(
            [
                item["splits"]
                for item in data["settlements"]
                if item["your_expensewise_balance_with_friend"] < 0
            ]
        )
    )


async def _allocate_settlement_splits(
    settlement: Settlement,
    expense_groups,
    db: AsyncSession,
):
    remaining_amount = settlement.amount
    created_splits = []
    settled_details = []

    for splits in expense_groups:
        creditors = []
        debtors = []
        await get_settlement_creditors_debtors(splits, db, creditors, debtors)
        creditor_index = 0
        debtor_index = 0

        while (
            creditor_index < len(creditors)
            and debtor_index < len(debtors)
            and remaining_amount > 0
        ):
            creditor = creditors[creditor_index]
            debtor = debtors[debtor_index]
            transfer = min(creditor["balance"], abs(debtor["balance"]))
            amount_to_settle = transfer

            is_requested_pair = (
                debtor["user"].id == settlement.from_user
                and creditor["user"].id == settlement.to_user
            )
            if is_requested_pair:
                amount_to_settle = min(transfer, remaining_amount)
                if amount_to_settle > 0:
                    settlement_split = SettlementSplits(
                        settlement_id=settlement.id,
                        split_id=debtor["split_id"],
                        amount_settled=amount_to_settle,
                    )
                    db.add(settlement_split)
                    created_splits.append(settlement_split)
                    settled_details.append(
                        {
                            "expense": splits[0].expense,
                            "settled_amount": amount_to_settle,
                            "remaining_debt_for_this_expense": (
                                transfer - amount_to_settle
                            ),
                        }
                    )
                    remaining_amount -= amount_to_settle

            creditor["balance"] -= amount_to_settle
            debtor["balance"] += amount_to_settle

            if creditor["balance"] <= 0:
                creditor_index += 1
            if debtor["balance"] >= 0:
                debtor_index += 1

        if remaining_amount <= 0:
            break

    if remaining_amount > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The remaining debt changed and no longer covers this request",
        )

    return created_splits, settled_details


# * create settlement
@settlements_router.post(
    "/",
    response_model=SettlementRequestResponseSchema,
    status_code=status.HTTP_201_CREATED,
)
async def create_settlement_request(
    settlement: SettlementCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.id == settlement.to_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot settle with yourself.",
        )

    available_debt, effective_group_id = await _get_request_scope_debt(
        from_user=current_user,
        to_user_id=settlement.to_user,
        expense_id=settlement.expense_id,
        group_id=settlement.group_id,
        db=db,
    )
    if available_debt <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You do not owe this user in the selected settlement scope",
        )
    if settlement.amount > available_debt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Settlement amount cannot be greater than the remaining debt",
        )

    new_settlement = Settlement(
        expense_id=settlement.expense_id,
        group_id=effective_group_id,
        from_user=current_user.id,
        to_user=settlement.to_user,
        amount=settlement.amount,
        payment_method=settlement.payment_method,
        note=settlement.note,
        settlement_date=settlement.settlement_date,
        status=SettlementStatus.PENDING,
    )
    new_settlement.payer = current_user
    db.add(new_settlement)
    try:
        await db.flush()
        expense_groups = await _get_split_groups_for_settlement(new_settlement, db)
        created_splits, _ = await _allocate_settlement_splits(
            new_settlement, expense_groups, db
        )
        if not created_splits:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No outstanding debt was found for this settlement request",
            )
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return await _get_settlement(new_settlement.id, db)


# * get sent pending settlement requests
@settlements_router.get(
    "/requests/sent", response_model=list[SettlementRequestResponseSchema]
)
async def get_sent_settlement_requests(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(
        _settlement_query()
        .where(
            Settlement.from_user == current_user.id,
            Settlement.status == SettlementStatus.PENDING,
        )
        .order_by(Settlement.created_at.desc(), Settlement.id.desc())
    )
    return result.scalars().all()


# * get received pending settlement request
@settlements_router.get(
    "/requests/received", response_model=list[SettlementRequestResponseSchema]
)
async def get_received_settlement_requests(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(
        _settlement_query()
        .where(
            Settlement.to_user == current_user.id,
            Settlement.status == SettlementStatus.PENDING,
        )
        .order_by(Settlement.created_at.desc(), Settlement.id.desc())
    )
    return result.scalars().all()


# * cancel sent settlement request
@settlements_router.delete(
    "/requests/{settlement_id}", response_model=SettlementRequestResponseSchema
)
async def cancel_settlement_request(
    settlement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    settlement = await _get_settlement(settlement_id, db)
    if settlement.from_user != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the sender can cancel this settlement request",
        )
    if settlement.status != SettlementStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending settlement requests can be cancelled",
        )

    settlement.status = SettlementStatus.CANCELLED
    settlement.responded_at = datetime.now(timezone.utc)
    await db.commit()
    return await _get_settlement(settlement_id, db)


# * reject received settlement request
@settlements_router.post(
    "/requests/{settlement_id}/reject",
    response_model=SettlementRequestResponseSchema,
)
async def reject_settlement_request(
    settlement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    settlement = await _get_settlement(settlement_id, db)
    if settlement.to_user != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the recipient can reject this settlement request",
        )
    if settlement.status != SettlementStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending settlement requests can be rejected",
        )

    settlement.status = SettlementStatus.REJECTED
    settlement.responded_at = datetime.now(timezone.utc)
    await db.commit()
    return await _get_settlement(settlement_id, db)


# * do settlement
async def _accept_settlement_request(
    settlement_id: int,
    expected_scope: str,
    db: AsyncSession,
    current_user,
):
    settlement = await _get_settlement(settlement_id, db)

    actual_scope = (
        "expense"
        if settlement.expense_id is not None
        else "group" if settlement.group_id is not None else "overall"
    )
    if actual_scope != expected_scope:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This request is not a {expected_scope} settlement",
        )

    result = await db.execute(
        select(SettlementSplits)
        .options(
            selectinload(SettlementSplits.expense_split).selectinload(
                ExpenseSplits.expense
            )
        )
        .where(SettlementSplits.settlement_id == settlement.id)
        .order_by(SettlementSplits.id)
    )
    existing_splits = result.scalars().all()
    allocated_amount = sum(
        (split.amount_settled for split in existing_splits), Decimal("0")
    )

    # Older pending requests may not have had their debt allocations reserved yet.
    if not existing_splits:
        expense_groups = await _get_split_groups_for_settlement(settlement, db)
        available_debt = Decimal("0")
        for splits in expense_groups:
            available_debt += await _pairwise_debt(
                splits, settlement.from_user, settlement.to_user, db
            )
        if available_debt < settlement.amount:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The remaining debt changed and no longer covers this request",
            )
        new_splits, _ = await _allocate_settlement_splits(
            settlement, expense_groups, db
        )
        if not new_splits:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No outstanding debt was found for this settlement request",
            )
        result = await db.execute(
            select(SettlementSplits)
            .options(
                selectinload(SettlementSplits.expense_split).selectinload(
                    ExpenseSplits.expense
                )
            )
            .where(SettlementSplits.settlement_id == settlement.id)
            .order_by(SettlementSplits.id)
        )
        existing_splits = result.scalars().all()
        allocated_amount = sum(
            (split.amount_settled for split in existing_splits), Decimal("0")
        )
    if allocated_amount != settlement.amount:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The provisional settlement allocations do not match the request amount",
        )

    amounts_by_expense = {}
    expense_by_id = {}
    for split in existing_splits:
        expense = split.expense_split.expense
        amounts_by_expense[expense.id] = (
            amounts_by_expense.get(expense.id, Decimal("0")) + split.amount_settled
        )
        expense_by_id[expense.id] = expense
    settled_details = [
        {
            "expense": expense_by_id[expense_id],
            "settled_amount": amount,
            "remaining_debt_for_this_expense": await _remaining_pairwise_debt_for_expense(
                expense_id, settlement.from_user, settlement.to_user, db
            ),
        }
        for expense_id, amount in amounts_by_expense.items()
    ]

    settlement.status = SettlementStatus.CONFIRMED
    settlement.responded_at = datetime.now(timezone.utc)
    await db.flush()
    await db.commit()

    result = await db.execute(
        _settlement_query()
        .options(selectinload(Settlement.settlement_splits))
        .where(Settlement.id == settlement_id)
    )
    saved_settlement = result.scalars().one()
    return {
        "message": "Settlement confirmed successfully",
        "status": saved_settlement.status,
        "settled_splits": settled_details,
        "settlement_splits": saved_settlement.settlement_splits,
    }


# * settlement
@settlements_router.post("/{settlement_id}", response_model=SettlementResponseSchema)
async def settle_up_expensewise_api(
    settlement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):

    settlement = await _get_settlement(settlement_id, db)
    if settlement.to_user != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the recipient can accept this settlement request",
        )
    if settlement.status != SettlementStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This settlement request has already been processed",
        )

    if settlement.expense_id:
        return await _accept_settlement_request(
            settlement_id, "expense", db, current_user
        )
    elif settlement.group_id:
        return await _accept_settlement_request(
            settlement_id, "group", db, current_user
        )
    else:
        return await _accept_settlement_request(
            settlement_id, "overall", db, current_user
        )
