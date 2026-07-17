from sqlalchemy import select
from collections import defaultdict
from model import ExpenseSplits
from sqlalchemy.orm import selectinload

async def generate_expense_groups(expense_ids, db, wantSorted):
    # gettings all splits of all expense ids at once
    result = await db.execute(
        select(ExpenseSplits)
        .options(selectinload(ExpenseSplits.user), selectinload(ExpenseSplits.expense))
        .where(ExpenseSplits.expense_id.in_(expense_ids))
        .order_by(ExpenseSplits.expense_id)
    )
    all_expense_splits = result.scalars().all()

    expense_groups = defaultdict(list)

    for split in all_expense_splits:
        expense_groups[split.expense_id].append(split)
        
    
    # expense groups:
    # {
    #     3: [split1, split2, split3],
    #     5: [split4, split5],
    #     7: [split6, split7, split8, split9],
    #     9: [split10, split11]
    # }
        
        
    # sorts the splits according to expense's expense date, so newest expense splits comes first, the order is newest -> oldest
    sorted_groups = sorted(
        expense_groups.values(),
        key=lambda splits: splits[0].expense.expense_date,
        reverse=True if wantSorted else False,
    )
        
    return sorted_groups