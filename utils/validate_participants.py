from fastapi import HTTPException, status


def validate_participants(participants_id_raw, participant_ids_set, current_user):
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

    # get all the friend ids
    friends_ids = {
        current_user.id,
        *[friend.friend_id for friend in current_user.sent_friendships],
        *[friend.user_id for friend in current_user.received_friendships],
    }

    # user is a pariticipant but not a friend
    invalid_ids = participant_ids_set - friends_ids
    if invalid_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot split an expense with non-friend users: {sorted(invalid_ids)}",
        )
