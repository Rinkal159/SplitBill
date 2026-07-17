from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from auth.authentication import get_current_user
from utils.get_friend_settlement_data import get_friend_settlement_data
from decimal import Decimal
from utils.get_settlement_groups import get_settlement_groups

from model import Settlement, SettlementSplits
from schemas.settlement_schema import OverallSettlementCreate

settlements_router = APIRouter(prefix="/api/settlements", tags=["Settlements"])


# settle up expense wise
@settlements_router.post("/expense")
def create_settlement_expensewise_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    return {"message": "success"}


# settple up overall with a friend
@settlements_router.post("/overall")
async def create_settlement_overall_api(
    settlement: OverallSettlementCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    friend_settlement_data = await get_friend_settlement_data(
        friend_id=settlement.to_user, db=db, current_user=current_user
    )

    if friend_settlement_data["total_balance"] < 0:
        if settlement.amount > abs(friend_settlement_data["total_balance"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Settlement amount cannot be greater than total debt",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot settle up if you do not have borrowings",
        )

    new_settlement = Settlement(
        from_user=current_user.id,
        to_user=settlement.to_user,
        amount=settlement.amount,
        settled_at=settlement.settled_at,
    )

    db.add(new_settlement)
    await db.flush()

    for splits in friend_settlement_data["expense_groups"]:
        settlement_groups = await get_settlement_groups(splits=splits, db=db)

        creditors = []
        debtors = []
        balance_creditors = {}

        for split in splits:
            balance = split.paid_amount - split.share_amount

            if balance > 0:
                creditors.append(
                    {"user": split.user, "balance": balance, "split_id": split.id}
                )
            elif balance < 0:
                existing_settlement = settlement_groups.get(split.id, [])
                
                total_settled = Decimal("0")
                
                if existing_settlement:
                    
                    # every settlement split of that split id
                    for settlement_split in existing_settlement:
                        total_settled += settlement_split.amount_settled
                        
                        creditor_id = settlement_split.settlement.to_user
                        balance_creditors[creditor_id] = (
                            balance_creditors.get(creditor_id, Decimal("0")) + settlement_split.amount_settled
                        ) 

                balance += total_settled

                if balance < 0:
                    debtors.append(
                        {"user": split.user, "balance": balance, "split_id": split.id}
                    )
                    
        for c in creditors:
            c["balance"] -= balance_creditors.get(c["user"].id, Decimal("0"))

        i = 0
        j = 0

        while i < len(creditors) and j < len(debtors) and settlement.amount > 0:
            creditor = creditors[i]
            debtor = debtors[j]

            creditor_balance = creditor["balance"]
            debtor_balance = abs(debtor["balance"])

            transfer = min(creditor_balance, debtor_balance)
            amount_to_transfer = transfer

            if (
                debtor["user"].id == current_user.id
                and creditor["user"].id == settlement.to_user
            ):
                amount_to_transfer = min(settlement.amount, transfer)

                new_settlement_split = SettlementSplits(
                    settlement_id=new_settlement.id,
                    split_id=debtor["split_id"],
                    amount_settled=amount_to_transfer,
                )
                db.add(new_settlement_split)

                settlement.amount -= amount_to_transfer

            creditor["balance"] -= amount_to_transfer
            debtor["balance"] += amount_to_transfer

            if creditor["balance"] <= 0:
                i += 1

            if debtor["balance"] <= 0:
                j += 1

        if settlement.amount <= 0:
            break

    await db.commit()

    return {"message": "Settled successfully!"}
