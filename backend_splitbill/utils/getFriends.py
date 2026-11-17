from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend_splitbill.database import get_db
from backend_splitbill.auth.authentication import get_current_user
from sqlalchemy import select

from backend_splitbill.model import User
from backend_splitbill.utils.get_friend_ids import get_friend_ids


async def getFriends(db, current_user):
    friends_ids = await get_friend_ids(db, current_user.id)

    if not friends_ids:
        return []

    # get all friends in just one query
    result = await db.execute(select(User).where(User.id.in_(friends_ids)))
    return result.scalars().all()
