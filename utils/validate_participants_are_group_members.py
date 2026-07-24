from model import GroupMember
from sqlalchemy import select
from fastapi import HTTPException

async def are_group_members(db, group_id, ids):
    # check all participants are group members
    result = await db.execute(select(GroupMember.user_id).where(
        GroupMember.group_id == group_id,
        GroupMember.user_id.in_(ids)
    ))
    members = result.scalars().all()
    
    if len(ids) != len(members):
        raise HTTPException(
            status_code=400,
            detail="All group members must be included in a group expense."
        )
    