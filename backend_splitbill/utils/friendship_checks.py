from sqlalchemy import select, and_, or_
from fastapi import HTTPException, status
from backend_splitbill.model import User, Friends
from backend_splitbill.utils.get_friend_settlement_data import (
    get_friend_settlement_data,
)
from backend_splitbill.utils.is_your_friend import is_your_friend

async def friendship_checks(db, current_user, friend_id):
    await is_your_friend(db, current_user, friend_id)
    
    # get settlement data
    friend_settlement_data = await get_friend_settlement_data(
        friend_id=friend_id, db=db, current_user=current_user
    )

    return {
        "friend_settlement_data": friend_settlement_data
    }
