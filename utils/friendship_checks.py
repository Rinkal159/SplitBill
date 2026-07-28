from sqlalchemy import select, and_, or_
from fastapi import HTTPException, status
from model import User, Friends
from utils.get_friend_settlement_data import get_friend_settlement_data

async def friendship_checks(db, current_user, friend_id):
    # friend not exist
    result = await db.execute(select(User).where(User.id == friend_id))
    friend = result.scalars().one_or_none()

    if not friend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Friend not found"
        )
        
    # you and friend_id are not friends
    result = await db.execute(
        select(Friends).where(
            or_(
                and_(
                    Friends.user_id == current_user.id,
                    Friends.friend_id == friend_id,
                ),
                and_(
                    Friends.friend_id == current_user.id,
                    Friends.user_id == friend_id,
                ),
            )
        )
    )
    existed_friendship = result.scalars().one_or_none()
    
    if not existed_friendship:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Friendship not found"
        )
        
    # get settlement data
    friend_settlement_data = await get_friend_settlement_data(
        friend_id=friend_id, db=db, current_user=current_user
    )
    
    return {
        "friend_settlement_data" : friend_settlement_data,
        "existed_friendship" : existed_friendship
    }