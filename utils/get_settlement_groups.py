from sqlalchemy import select
from model import SettlementSplits
from collections import defaultdict
from sqlalchemy.orm import selectinload

async def get_settlement_groups(splits, db):
    split_ids = []
    for split in splits:
        split_ids.append(split.id)
        
    result = await db.execute(select(SettlementSplits).options(selectinload(SettlementSplits.settlement)).where(SettlementSplits.split_id.in_(split_ids)))
    all_settlement_splits = result.scalars().all()
    
    settlement_groups = defaultdict(list)
    
    for split in all_settlement_splits:
        settlement_groups[split.split_id].append(split)
        
    # settlement_groups = {
    #     5: [SettlementSplit1, SettlementSplit2],
    #     8: [SettlementSplit3],
    #     10: [SettlementSplit4, SettlementSplit5],
    # }
    
    return settlement_groups