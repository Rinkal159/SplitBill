from sqlalchemy import or_, select

from backend_splitbill.model import Friends


async def get_friend_ids(db, user_id: int) -> set[int]:
    result = await db.execute(
        select(Friends.user_id, Friends.friend_id).where(
            or_(Friends.user_id == user_id, Friends.friend_id == user_id)
        )
    )

    friend_ids = set()
    for first_id, second_id in result.all():
        friend_ids.add(second_id if first_id == user_id else first_id)
    return friend_ids
