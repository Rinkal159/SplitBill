from fastapi import APIRouter, Depends, HTTPException, status
from backend_splitbill.database import get_db
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend_splitbill.auth.authentication import get_current_user
from decimal import Decimal
from backend_splitbill.utils.friendship_checks import friendship_checks

from backend_splitbill.schemas.friends_schema import (
    InvitationCreate as InvitationCreateSchema,
    InvitationReceivedResponse as InvitationReceivedResponseSchema,
    InvitationSentResponse as InvitationSentResponseSchema,
    InvitationUpdateStatus as InvitationUpdateStatusSchema,
    InvitationUpdate as InvitationUpdateSchema,
    UserDetail as UserDetailSchema,
    FriendProfileResponse as FriendProfileResponseSchema,
)
from backend_splitbill.model import (
    User,
    Invitation,
    Friends,
    FriendsHistory,
    FriendsHistoryAction,
    InvitationStatus,
    Group,
    GroupMember,
)

friends_router = APIRouter(prefix="/api/friends", tags=["Friends"])


# * send invitation via email or mobile number
@friends_router.post("/invite")
async def invite_friend_api(
    invitation: InvitationCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    invitation_method = "email" if invitation.email else "mobile_number"
    invitation_value = invitation.email or invitation.mobile_number

    result = await db.execute(
        select(User).where(getattr(User, invitation_method) == invitation_value)
    )
    existed_invitee = result.scalars().one_or_none()

    # if invitee is registered
    if existed_invitee:

        # self invitation
        if existed_invitee.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot send invitation to yourself",
            )

        # already friends
        result = await db.execute(
            select(Friends).where(
                or_(
                    and_(
                        Friends.user_id == current_user.id,
                        Friends.friend_id == existed_invitee.id,
                    ),
                    and_(
                        Friends.user_id == existed_invitee.id,
                        Friends.friend_id == current_user.id,
                    ),
                )
            )
        )
        already_friends = result.scalars().one_or_none()

        if already_friends:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You and {existed_invitee.name} are already friends!",
            )

        # already sent or received invitation
        result = await db.execute(
            select(Invitation).where(
                or_(
                    and_(
                        Invitation.inviter_id == current_user.id,
                        Invitation.invitee_id == existed_invitee.id,
                    ),
                    and_(
                        Invitation.inviter_id == existed_invitee.id,
                        Invitation.invitee_id == current_user.id,
                    ),
                ),
                Invitation.status == InvitationStatus.PENDING,
            )
        )
        existed_invitation = result.scalars().one_or_none()

        if existed_invitation:
            if existed_invitation.inviter_id == current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"You've already sent invitation to {existed_invitee.name}",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"{existed_invitee.name} has already sent invitation to you.",
                )

        # create new invitation, only stores inviter id and invitee id
        new_invitation = Invitation(
            inviter_id=current_user.id, invitee_id=existed_invitee.id
        )
        db.add(new_invitation)

    # if invitee is not registered
    else:
        invitation_method = (
            "invitee_email" if invitation.email else "invitee_mobile_number"
        )

        # already sent invitation to same invitation method
        result = await db.execute(
            select(Invitation).where(
                Invitation.inviter_id == current_user.id,
                getattr(Invitation, invitation_method) == invitation_value,
                Invitation.status == InvitationStatus.PENDING,
            )
        )
        existed_invitation = result.scalars().one_or_none()

        if existed_invitation:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You've already sent friend request to {invitation_value}",
            )

        new_invitation = Invitation(
            inviter_id=current_user.id, **{invitation_method: invitation_value}
        )
        db.add(new_invitation)

    await db.flush()

    new_friend_history = FriendsHistory(
        sender_id=current_user.id,
        receiver_id=existed_invitee.id if existed_invitee else None,
        invitation_id=new_invitation.id,
        guest_invitee=None if existed_invitee else invitation_value,
        action="REQUEST_SENT",
        performed_by=current_user.id,
    )
    db.add(new_friend_history)

    await db.commit()

    return {"message": "Invitation sent successfully!"}


# * get all the invitations you got
@friends_router.get(
    "/invitations/received", response_model=list[InvitationReceivedResponseSchema]
)
async def get_invitations_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(Invitation).where(
            Invitation.invitee_id == current_user.id,
            Invitation.status == InvitationStatus.PENDING,
        )
    )
    existed_invitations = result.scalars().all()

    return existed_invitations


# * get all sent invitations
@friends_router.get(
    "/invitations/sent", response_model=list[InvitationSentResponseSchema]
)
async def get_sent_friends_invitations_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(Invitation).where(
            Invitation.inviter_id == current_user.id,
            Invitation.status == InvitationStatus.PENDING,
        )
    )
    existed_invitations = result.scalars().all()

    return existed_invitations


# * accept or reject invitation
@friends_router.patch("/invitations/{invitation_id}")
async def action_on_invitation_api(
    invitation_id: int,
    new_status: InvitationUpdateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(select(Invitation).where(Invitation.id == invitation_id))
    existed_invitation = result.scalars().one_or_none()

    # invitation doesn't exist
    if not existed_invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found"
        )

    # if you're not the invitee or the status is not pending
    if (
        existed_invitation.invitee_id != current_user.id
        or existed_invitation.status != InvitationStatus.PENDING
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized to perform requested actions.",
        )

    # accept
    if new_status.status == InvitationUpdateStatusSchema.ACCEPTED:
        existed_invitation.status = InvitationStatus.ACCEPTED
        new_friends = Friends(
            user_id=min(existed_invitation.inviter_id, existed_invitation.invitee_id),
            friend_id=max(existed_invitation.inviter_id, existed_invitation.invitee_id),
        )
        db.add(new_friends)

        new_friend_history = FriendsHistory(
            sender_id=existed_invitation.inviter_id,
            receiver_id=current_user.id,
            invitation_id=existed_invitation.id,
            action="REQUEST_ACCEPTED",
            performed_by=current_user.id,
        )
        db.add(new_friend_history)

    # reject
    else:
        existed_invitation.status = InvitationStatus.REJECTED

    await db.commit()

    message = f"Invitation {new_status.status.value.lower()} successfully!"
    return {"message": message}


# * cancel invitation
@friends_router.delete("/invitations/{invitation_id}")
async def cancel_invitation_api(
    invitation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        # invitation not exist
        result = await db.execute(
            select(Invitation).where(Invitation.id == invitation_id)
        )
        existed_invitation = result.scalars().one_or_none()

        if not existed_invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found"
            )

        # you're not the inviter or status is not pending
        if (
            existed_invitation.inviter_id != current_user.id
            or existed_invitation.status != InvitationStatus.PENDING
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to perform requested action",
            )

        existed_invitation.status = InvitationStatus.CANCELLED

        new_friend_history = FriendsHistory(
            sender_id=current_user.id,
            receiver_id=(
                existed_invitation.invitee_id if existed_invitation.invitee_id else None
            ),
            guest_invitee=(
                None
                if existed_invitation.invitee_id
                else existed_invitation.invitee_email
                or existed_invitation.invitee_mobile_number
            ),
            action=FriendsHistoryAction.REQUEST_CANCELLED,
            performed_by=current_user.id,
        )
        db.add(new_friend_history)

        await db.commit()
    except:
        await db.rollback()
        raise

    return {"message": "Invitation cancelled successfully!"}


# * get all the friends
@friends_router.get("/", response_model=list[UserDetailSchema])
async def get_friends_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):

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


# * remove a friend
@friends_router.delete("/{friend_id}")
async def remove_friend_api(
    friend_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        # friend settlement data - you need total balance
        response = await friendship_checks(
            db=db, current_user=current_user, friend_id=friend_id
        )
        friend_settlement_data = response["friend_settlement_data"]
        existed_friendship = response["existed_friendship"]

        total_balance = friend_settlement_data["total_balance"]
        if total_balance != Decimal("0"):
            message = f"You cannnot unfriend {existed_friendship.friend.name if existed_friendship.user_id == current_user.id else existed_friendship.user.name}, you {'lent' if total_balance > Decimal("0") else 'borrowed'} {abs(total_balance)}. As outstanding financial obligation exist between you two, you cannot remove friend until all balances are settled."
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

        await db.delete(existed_friendship)

        new_friends_history = FriendsHistory(
            sender_id=current_user.id,
            receiver_id=friend_id,
            action=FriendsHistoryAction.FRIEND_REMOVED,
            performed_by=current_user.id,
        )
        db.add(new_friends_history)

        await db.commit()
    except:
        await db.rollback()
        raise

    return {"message": "Removed friend successfully!"}


# * see friends profile - friend, total balance and groups in which you and friend are included
@friends_router.get("/{friend_id}", response_model=FriendProfileResponseSchema)
async def get_friend(
    friend_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # friend settlement data - you need friend and total balance
    response = await friendship_checks(
        db=db, current_user=current_user, friend_id=friend_id
    )
    friend_settlement_data = response["friend_settlement_data"]

    # groups in which you're included
    groups_you_are_included = (
        select(GroupMember.group_id)
        .join(Group)
        .where(GroupMember.user_id == current_user.id, Group.is_deleted.is_(False))
    )

    # groups in which you and your friend both are included
    result = await db.execute(
        select(Group)
        .join(GroupMember)
        .where(
            GroupMember.user_id == friend_id,
            GroupMember.group_id.in_(groups_you_are_included),
        )
    )
    groups_you_and_friend_included = result.scalars().all()

    return {
        "friend": friend_settlement_data["friend"],
        "total_balance": friend_settlement_data["total_balance"],
        "common_groups": groups_you_and_friend_included,
    }
