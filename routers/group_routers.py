from fastapi import APIRouter, Depends, HTTPException, status
from database import get_db
from auth.authentication import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from utils.get_member_settlement_data import get_member_settlement_data
from utils.get_registered_and_guest_invitees_of_group import (
    get_registered_and_guest_invitees_of_group,
)
from model import (
    Group,
    GroupMember,
    GroupMemberRole,
    User,
    GroupInvitation,
    InvitationStatus,
    GroupHistory,
    GroupHistoryAction,
)
from schemas.group_schema import (
    GroupCreate as GroupCreateSchema,
    GroupUpdate as GroupUpdateSchema,
    AdditionalInvitations as AdditionalInvitationsSchema,
    InvitationResponse as InvitationResponseSchema,
    InvitationUpdate as InvitationUpdateSchema,
    InvitationUpdateStatus,
    GroupResponse as GroupResponseSchema,
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
        # get registered ids, non-registered emails and mobile numbers
        existed_invitees, non_registered_emails, non_registered_mobile_numbers = (
            await get_registered_and_guest_invitees_of_group(db=db, group=group)
        )

        # creating group
        new_group = Group(
            name=group.name, description=group.description, created_by=current_user.id
        )

        db.add(new_group)
        await db.flush()

        # creating group history - GROUP_CREATED
        new_group_history = GroupHistory(
            group_id=new_group.id,
            action=GroupHistoryAction.GROUP_CREATED,
            performed_by=current_user.id,
        )
        db.add(new_group_history)

        # creating first group member - you as ADMIN
        new_group_member = GroupMember(
            group_id=new_group.id, user_id=current_user.id, role=GroupMemberRole.ADMIN
        )
        db.add(new_group_member)

        # group invitations to "registered" invitees
        for existed in existed_invitees:
            if existed.id == current_user.id:
                continue

            new_group_invitation = GroupInvitation(
                group_id=new_group.id, inviter_id=current_user.id, invitee_id=existed.id
            )
            db.add(new_group_invitation)

            await db.flush()

            new_group_history = GroupHistory(
                group_id=new_group.id,
                invitation_id=new_group_invitation.id,
                sender_id=current_user.id,
                receiver_id=existed.id,
                action=GroupHistoryAction.GROUP_INVITATION_SENT,
                performed_by=current_user.id,
            )
            db.add(new_group_history)

        # group invitations to "non-registered" invitees - email
        for email in non_registered_emails:
            new_group_invitation = GroupInvitation(
                group_id=new_group.id, inviter_id=current_user.id, invitee_email=email
            )
            db.add(new_group_invitation)

            await db.flush()

            new_group_history = GroupHistory(
                group_id=new_group.id,
                invitation_id=new_group_invitation.id,
                sender_id=current_user.id,
                guest_invitee=email,
                action=GroupHistoryAction.GROUP_INVITATION_SENT,
                performed_by=current_user.id,
            )
            db.add(new_group_history)

        # group invitations to "non-registered" invitees - mobile_number
        for mobile_number in non_registered_mobile_numbers:
            new_group_invitation = GroupInvitation(
                group_id=new_group.id,
                inviter_id=current_user.id,
                invitee_mobile_number=mobile_number,
            )
            db.add(new_group_invitation)

            await db.flush()

            new_group_history = GroupHistory(
                group_id=new_group.id,
                invitation_id=new_group_invitation.id,
                sender_id=current_user.id,
                guest_invitee=mobile_number,
                action=GroupHistoryAction.GROUP_INVITATION_SENT,
                performed_by=current_user.id,
            )
            db.add(new_group_history)

        await db.commit()

    except:
        await db.rollback()
        raise

    return {"message": "Created group successfully!"}


# * update group info
@group_router.patch("/{group_id}")
async def add_members_api(
    group_id: int,
    group: GroupUpdateSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        # if group doesn't exist
        result = await db.execute(
            select(Group).where(Group.id == group_id, Group.is_deleted == False)
        )
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
            
        group_dict = group.model_dump(exclude_unset=True)

        # updating group info
        for key, val in group_dict.items():
            setattr(Group, key, val)

        await db.commit()
    except:
        await db.rollback()
        raise

    return {"message": "Group edited successfully!"}


# * send additional invitations
@group_router.post("/{group_id}/invititations")
async def send_invitations(
    group_id: int,
    invitations: AdditionalInvitationsSchema,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        # if group doesn't exist
        result = await db.execute(
            select(Group).where(Group.id == group_id, Group.is_deleted == False)
        )
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

        # get registered ids, non-registered emails and mobile numbers
        existed_invitees, non_registered_emails, non_registered_mobile_numbers = (
            await get_registered_and_guest_invitees_of_group(db=db, group=invitations)
        )

        # group members
        result = await db.execute(
            select(GroupMember.user_id).where(GroupMember.group_id == group_id)
        )
        group_members = set(result.scalars().all())

        # group invitations
        result = await db.execute(
            select(
                GroupInvitation.invitee_id,
                GroupInvitation.invitee_email,
                GroupInvitation.invitee_mobile_number,
            ).where(
                GroupInvitation.group_id == group_id,
                GroupInvitation.status == InvitationStatus.PENDING,
            )
        )
        group_invitations = result.all()

        already_sent_invitee_ids = {
            invitation.invitee_id
            for invitation in group_invitations
            if invitation.invitee_id
        }
        already_sent_invitee_emails = {
            invitation.invitee_email
            for invitation in group_invitations
            if invitation.invitee_email
        }
        already_sent_invitee_mobile_numbers = {
            invitation.invitee_mobile_number
            for invitation in group_invitations
            if invitation.invitee_mobile_number
        }

        # group invitations to "registered" invitees
        for existed in existed_invitees:

            # self invitation
            if existed.id == current_user.id:
                continue

            # already a group member
            if existed.id in group_members:
                continue

            # already sent invitation
            if existed.id in already_sent_invitee_ids:
                continue

            new_group_invitation = GroupInvitation(
                group_id=existed_group.id,
                inviter_id=current_user.id,
                invitee_id=existed.id,
            )
            db.add(new_group_invitation)

            await db.flush()

            new_group_history = GroupHistory(
                group_id=existed_group.id,
                invitation_id=new_group_invitation.id,
                sender_id=current_user.id,
                receiver_id=existed.id,
                action=GroupHistoryAction.GROUP_INVITATION_SENT,
                performed_by=current_user.id,
            )
            db.add(new_group_history)

        # group invitations to "non-registered" invitees - email
        for email in non_registered_emails:

            # already sent invitation
            if email in already_sent_invitee_emails:
                continue

            new_group_invitation = GroupInvitation(
                group_id=existed_group.id,
                inviter_id=current_user.id,
                invitee_email=email,
            )
            db.add(new_group_invitation)

            await db.flush()

            new_group_history = GroupHistory(
                group_id=existed_group.id,
                invitation_id=new_group_invitation.id,
                sender_id=current_user.id,
                guest_invitee=email,
                action=GroupHistoryAction.GROUP_INVITATION_SENT,
                performed_by=current_user.id,
            )
            db.add(new_group_history)

        # group invitations to "non-registered" invitees - mobile_number
        for mobile_number in non_registered_mobile_numbers:

            # already sent invitation
            if mobile_number in already_sent_invitee_mobile_numbers:
                continue

            new_group_invitation = GroupInvitation(
                group_id=existed_group.id,
                inviter_id=current_user.id,
                invitee_mobile_number=mobile_number,
            )
            db.add(new_group_invitation)

            await db.flush()

            new_group_history = GroupHistory(
                group_id=existed_group.id,
                invitation_id=new_group_invitation.id,
                sender_id=current_user.id,
                guest_invitee=mobile_number,
                action=GroupHistoryAction.GROUP_INVITATION_SENT,
                performed_by=current_user.id,
            )
            db.add(new_group_history)

        await db.commit()
    except:
        await db.rollback()
        raise
    
    return {"message" : "Sent invitations successfully!"}


# * get group invitations
@group_router.get("/invitations", response_model=list[InvitationResponseSchema])
async def get_group_invitations_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(GroupInvitation)
        .join(Group)
        .where(
            GroupInvitation.invitee_id == current_user.id,
            GroupInvitation.status == InvitationStatus.PENDING,
            Group.is_deleted.is_(False),
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
        select(GroupInvitation)
        .join(Group)
        .where(GroupInvitation.id == invitation_id, Group.is_deleted.is_(False))
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
    if existed_invitation.status != InvitationStatus.PENDING:
        raise HTTPException(
            status_code=400, detail="This invitation has already been processed."
        )

    # accepts invitation
    if new_status.status == InvitationUpdateStatus.ACCEPTED:
        existed_invitation.status = InvitationStatus.ACCEPTED

        # creating new group member
        new_group_member = GroupMember(
            group_id=existed_invitation.group_id, user_id=current_user.id
        )
        db.add(new_group_member)

        new_group_history = GroupHistory(
            group_id=existed_invitation.group_id,
            invitation_id=existed_invitation.id,
            sender_id=existed_invitation.inviter_id,
            receiver_id=current_user.id,
            action=GroupHistoryAction.GROUP_INVITATION_ACCEPTED,
            performed_by=current_user.id,
        )
        db.add(new_group_history)

    # rejects invitation
    else:
        existed_invitation.status = InvitationStatus.REJECTED

    await db.commit()

    return {"message": f"Invitation {new_status.status.value.lower()} successfully!"}


# * get groups in which you're a member or admin
@group_router.get("/", response_model=list[GroupResponseSchema])
async def get_groups_api(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(
        select(GroupMember)
        .join(Group)
        .where(GroupMember.user_id == current_user.id, Group.is_deleted.is_(False))
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
    "/{group_id}/members/{user_id}/expenses",
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
