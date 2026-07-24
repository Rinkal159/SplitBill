from fastapi import APIRouter, Depends, HTTPException, status
from database import get_db
from auth.authentication import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from utils.get_member_settlement_data import get_member_settlement_data

from model import (
    Group,
    GroupMember,
    GroupMemberRole,
    User,
    GroupInvitation,
    GroupInvitationStatus,
)
from schemas.group_schema import (
    GroupCreate as GroupCreateSchema,
    InvitationResponse as InvitationResponseSchema,
    InvitationUpdate as InvitationUpdateSchema,
    InvitationUpdateStatus,
    GroupResponse as GroupResponseSchema,
    GroupInvitationSchema,
    ExpenseWithSpecificMemberResponse as ExpenseWithSpecificMemberResponseSchema,
)

group_router = APIRouter(prefix="/api/groups", tags=["Groups"])


# * create a group
@group_router.post("/")
async def create_group_api(
    group: GroupCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        emails = [
            invitation.email for invitation in group.invitations if invitation.email
        ]
        mobile_numbers = [
            invitation.mobile_number
            for invitation in group.invitations
            if invitation.mobile_number
        ]

        # duplicate emails entered in invitation
        if len(emails) != len(set(emails)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate email invitations found",
            )

        # duplicate mobile numbers entered in invitation
        if len(mobile_numbers) != len(set(mobile_numbers)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate mobile number invitations found",
            )

        # creating group
        new_group = Group(
            name=group.name, description=group.description, created_by=current_user.id
        )

        db.add(new_group)
        await db.flush()

        # creating first group member - you as ADMIN
        new_group_member = GroupMember(
            group_id=new_group.id, user_id=current_user.id, role=GroupMemberRole.ADMIN
        )

        db.add(new_group_member)

        result = await db.execute(
            select(User).where(
                or_(User.email.in_(emails), User.mobile_number.in_(mobile_numbers))
            )
        )

        existed_invitees = result.scalars().all()

        registered_emails = {user.email for user in existed_invitees}
        registered_mobile_numbers = {user.mobile_number for user in existed_invitees}

        non_registered_emails = [
            email for email in emails if email not in registered_emails
        ]

        non_registered_mobile_numbers = [
            mobile_number
            for mobile_number in mobile_numbers
            if mobile_number not in registered_mobile_numbers
        ]

        # group invitations to registered invitees
        for existed in existed_invitees:
            if existed.id == current_user.id:
                continue

            new_group_invitation = GroupInvitation(
                group_id=new_group.id, inviter_id=current_user.id, invitee_id=existed.id
            )
            db.add(new_group_invitation)

        # group invitations to non-registered invitees - email
        for email in non_registered_emails:
            new_group_invitation = GroupInvitation(
                group_id=new_group.id, inviter_id=current_user.id, invitee_email=email
            )
            db.add(new_group_invitation)

        # group invitations to non-registered invitees - mobile_number
        for mobile_number in non_registered_mobile_numbers:
            new_group_invitation = GroupInvitation(
                group_id=new_group.id,
                inviter_id=current_user.id,
                invitee_mobile_number=mobile_number,
            )
            db.add(new_group_invitation)

        await db.commit()

    except:
        await db.rollback()
        raise

    return {"message": "Created group successfully!"}


# * send group inviations additionally
@group_router.post("/{group_id}/invite")
async def add_members_api(
    group_id: int,
    invitation: GroupInvitationSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # if group doesn't exist
    result = await db.execute(select(Group).where(Group.id == group_id))
    existed_group = result.scalars().one_or_none()

    if not existed_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )

    # if you're not the admin
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role == GroupMemberRole.ADMIN,
        )
    )
    admin = result.scalars().one_or_none()

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You're not authorized to perform requested action",
        )

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
                detail="You are already a member of this group.",
            )

        # invitee is already member of the group
        result = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == existed_invitee.id,
            )
        )
        existed_member = result.scalars().one_or_none()

        if existed_member:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Invitee is already member of the group",
            )

        # already sent invitation to the invitee
        result = await db.execute(
            select(GroupInvitation).where(
                GroupInvitation.group_id == group_id,
                GroupInvitation.status == GroupInvitationStatus.PENDING,
                GroupInvitation.invitee_id == existed_invitee.id,
            )
        )
        existed_invitation = result.scalars().one_or_none()

        if existed_invitation:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Invitation is already sent to this invitee",
            )

        # creating invitation
        new_group_invitation = GroupInvitation(
            group_id=group_id, inviter_id=current_user.id, invitee_id=existed_invitee.id
        )
        db.add(new_group_invitation)

    # if invitee is not registered
    else:
        invitation_method = (
            "invitee_email" if invitation.email else "invitee_mobile_number"
        )

        # if already sent invitation from same method
        result = await db.execute(
            select(GroupInvitation).where(
                GroupInvitation.group_id == group_id,
                GroupInvitation.status == GroupInvitationStatus.PENDING,
                getattr(GroupInvitation, invitation_method) == invitation_value,
            )
        )
        existed_invitation = result.scalars().one_or_none()

        if existed_invitation:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You've already sent invitation to {invitation_value}",
            )

        # creating invitation
        new_group_invitation = GroupInvitation(
            group_id=group_id,
            inviter_id=current_user.id,
            **{invitation_method: invitation_value},
        )
        db.add(new_group_invitation)

    await db.commit()
    return {"message": "Sent group invitation successfully!"}


# * get group invitations
@group_router.get("/invitations", response_model=list[InvitationResponseSchema])
async def get_group_invitations_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(GroupInvitation).where(
            GroupInvitation.invitee_id == current_user.id,
            GroupInvitation.status == GroupInvitationStatus.PENDING,
        )
    )

    existed_invitations = result.scalars().all()

    return existed_invitations


# * accept or reject group inviatation
@group_router.patch("/invitations/{invitation_id}")
async def action_on_group_invitation_api(
    invitation_id: int,
    new_status: InvitationUpdateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # if invitation doesn't exist
    result = await db.execute(
        select(GroupInvitation).where(GroupInvitation.id == invitation_id)
    )
    existed_invitation = result.scalars().one_or_none()

    if not existed_invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group invitation not found"
        )

    # if you're not the invitee
    if existed_invitation.invitee_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You're not authorized to access this invitation."
        )

    # status is not PENDING
    if existed_invitation.status != GroupInvitationStatus.PENDING:
        raise HTTPException(
            status_code=400, detail="This invitation has already been processed."
        )

    # accepts invitation
    if new_status.status == InvitationUpdateStatus.ACCEPTED:
        existed_invitation.status = GroupInvitationStatus.ACCEPTED

        # creating new group member
        new_group_member = GroupMember(
            group_id=existed_invitation.group_id, user_id=current_user.id
        )
        db.add(new_group_member)

    # rejects invitation
    else:
        existed_invitation.status = GroupInvitationStatus.REJECTED

    await db.commit()

    return {"message": f"Invitation {new_status.status.value.lower()} successfully!"}


# * get groups in which you're a member or admin
@group_router.get("/", response_model=list[GroupResponseSchema])
async def get_groups(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(GroupMember)
        .where(GroupMember.user_id == current_user.id)
        .options(
            selectinload(GroupMember.group)
            .selectinload(Group.members)
            .selectinload(GroupMember.user)
        )
        .order_by(GroupMember.joined_at.desc())
    )
    groups = result.scalars().all()

    if not groups:
        return []

    return groups


# * get expenses and settlements with specific group member
@group_router.get(
    "/member/{group_id}/{user_id}",
    response_model=ExpenseWithSpecificMemberResponseSchema,
)
async def get_expenses_shared_with_member_api(
    group_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await get_member_settlement_data(
        group_id=group_id, user_id=user_id, db=db, current_user=current_user
    )
