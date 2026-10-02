from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend_splitbill.database import get_db
from backend_splitbill.auth.authentication import get_current_user
from sqlalchemy import select

from backend_splitbill.model import User


async def getFriends(db, current_user):
    # get all the friend ids
    friends_ids = {
        *[friend.friend_id for friend in current_user.sent_friendships],
        *[friend.user_id for friend in current_user.received_friendships],
    }

    if not friends_ids:
        return []

    # get all friends in just one query
    result = await db.execute(select(User).where(User.id.in_(friends_ids)))
    return result.scalars().all()
