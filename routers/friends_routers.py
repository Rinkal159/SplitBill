from fastapi import APIRouter, Depends, HTTPException, status
from database import get_db
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from auth.authentication import get_current_user

from schemas.friends_schema import (
    InvitationCreate as InvitationCreateSchema,
    InvitationsResponse as InvitationsResponseSchema,
    InvitationStatus,
    InvitationUpdate as InvitationUpdateSchema,
    UserDetail as UserDetailSchema
)
from model import User, Invitation, Friends

friends_router = APIRouter(prefix="/api/friends", tags=["Friends"])


# * send invitation via email or mobile number
@friends_router.post("/invite")
async def invite_friend_api(
    invitation: InvitationCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    inivitation_method = "email" if invitation.email else "mobile_number"
    inivitation_value = invitation.email or invitation.mobile_number

    result = await db.execute(
        select(User).where(getattr(User, inivitation_method) == inivitation_value)
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
                detail=f"Friendship already exists between you and {existed_invitee.name}",
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
                Invitation.status == "pending",
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
                getattr(Invitation, invitation_method) == inivitation_value,
                Invitation.status == "pending",
            )
        )
        existed_invitation = result.scalars().one_or_none()

        if existed_invitation:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You've already sent friend request to {inivitation_value}",
            )

        new_invitation = Invitation(
            inviter_id=current_user.id, **{invitation_method: inivitation_value}
        )
        db.add(new_invitation)

    await db.commit()

    return {"message": "Invitation sent successfully!"}


# * get all the invitations you got
@friends_router.get("/invitations", response_model=list[InvitationsResponseSchema])
async def get_invitations_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(Invitation).where(
            Invitation.invitee_id == current_user.id, Invitation.status == "pending"
        )
    )
    existed_invitations = result.scalars().all()

    return existed_invitations


# * accept or reject invitation
@friends_router.post("/invitations/{invitation_id}")
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
        or existed_invitation.status != "pending"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized to perform requested actions.",
        )

    # accept
    if new_status.status == InvitationStatus.accepted:
        existed_invitation.status = InvitationStatus.accepted
        new_friends = Friends(
            user_id=min(existed_invitation.inviter_id, existed_invitation.invitee_id),
            friend_id=max(existed_invitation.inviter_id, existed_invitation.invitee_id),
        )
        db.add(new_friends)
        
    # reject
    else:
        existed_invitation.status = InvitationStatus.rejected

    await db.commit()

    message = f"Invitation {new_status.status.value} successfully!"
    return {"message": message}


#* get all the friends  
@friends_router.get("/", response_model=list[UserDetailSchema])
async def get_friends_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    
    # get all the friend ids
    friends_ids = {
        *[friend.friend_id for friend in current_user.sent_friendships],
        *[friend.user_id for friend in current_user.received_friendships]
    }
    
    if not friends_ids:
        return []
    
    # get all friends in just one query
    result = await db.execute(select(User).where(User.id.in_(friends_ids)))
    
    return result.scalars().all()
