from fastapi import HTTPException, status
from backend_splitbill.utils.validate_participants_are_group_members import (
    are_group_members,
)
from backend_splitbill.utils.get_friend_ids import get_friend_ids


async def validate_participants(
    group_id, db, participants_id_raw, participant_ids_set, current_user
):
    if group_id is not None:
        await are_group_members(db, group_id, participants_id_raw)

    # if current user is not included in participants
    if current_user.id not in participant_ids_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be included in as a participant",
        )

    # if duplicate ids in participnats
    if len(participants_id_raw) != len(participant_ids_set):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate IDs are not allowed",
        )

    if group_id is None:
        friends_ids = await get_friend_ids(db, current_user.id)
        friends_ids.add(current_user.id)

        # user is a pariticipant but not a friend
        invalid_ids = participant_ids_set - friends_ids
        if invalid_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot split an expense with non-friend users: {sorted(invalid_ids)}",
            )
