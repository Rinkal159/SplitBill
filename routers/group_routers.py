from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from database import get_db
from auth.authentication import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from utils.get_member_settlement_data import get_member_settlement_data
from utils.get_registered_and_guest_invitees_of_group import (
    get_registered_and_guest_invitees_of_group,
)
from services.cloudinary import (
    upload_picture_on_cloudinary,
    delete_picture_from_cloudinary,
)
from utils.get_expense_groups import get_expense_groups
from utils.get_settlement_groups import get_settlement_groups
from utils.get_creditors_debtors import get_creditors_debtors

from model import (
    Group,
    GroupMember,
    GroupMemberRole,
    GroupInvitation,
    InvitationStatus,
    GroupHistory,
    GroupHistoryAction,
    Expense,
    ExpenseSplits,
)
from schemas.group_schema import (
    GroupCreate as GroupCreateSchema,
    GroupUpdate as GroupUpdateSchema,
    AdditionalInvitations as AdditionalInvitationsSchema,
    InvitationResponse as InvitationResponseSchema,
    InvitationUpdate as InvitationUpdateSchema,
    InvitationUpdateStatus,
    GroupResponse as GroupResponseSchema,
    SingleGroupResponse as SingleGroupResponseSchema,
    ExpenseWithSpecificMemberResponse as ExpenseWithSpecificMemberResponseSchema,
)

group_router = APIRouter(prefix="/api/groups", tags=["Groups"])


# * create a group
@group_router.post("/", response_model=SingleGroupResponseSchema)
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
        await db.refresh(new_group)
    except:
        await db.rollback()
        raise

    return {"group": new_group, "total_members": 1}


# * upload group picture
@group_router.post("/{group_id}/picture")
async def upload_group_picture(
    group_id: int,
    groupPicture: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        # group not exist
        result = await db.execute(
            select(Group).where(Group.id == group_id, Group.is_deleted.is_(False))
        )
        existed_group = result.scalars().one_or_none()

        if not existed_group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )

        # you're not a member of that group
        result = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id, GroupMember.user_id == current_user.id
            )
        )
        existed_member = result.scalars().one_or_none()

        if not existed_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to upload group picture",
            )

        # attachment already uploaded
        if existed_group.group_picture:
            delete_picture_from_cloudinary(existed_group.group_picture)

        # storing attachment in database (in expense table)
        if groupPicture:
            if groupPicture.filename:
                attachment_public_id = upload_picture_on_cloudinary(
                    file=groupPicture, folder="group_pictures"
                )
                existed_group.group_picture = attachment_public_id

        await db.commit()
    except:
        await db.rollback()
        raise

    return {"message": "Group picture uploaded successfully!"}


# * get group
@group_router.get("/{group_id}", response_model=SingleGroupResponseSchema)
async def get_group_api(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # group not exist
    result = await db.execute(
        select(Group).where(Group.id == group_id, Group.is_deleted.is_(False))
    )
    existed_group = result.scalars().one_or_none()

    if not existed_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )

    # you're not a member
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id, GroupMember.user_id == current_user.id
        )
    )
    existed_member = result.scalars().one_or_none()

    if not existed_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group.",
        )

    # count of members
    result = await db.execute(
        select(func.count())
        .select_from(GroupMember)
        .where(GroupMember.group_id == group_id)
    )
    members_count = result.scalar_one()

    # return group
    return {"group": existed_group, "total_members": members_count}


# * update group info
@group_router.patch("/{group_id}")
async def update_group_api(
    group_id: int,
    group: GroupUpdateSchema = Depends(GroupUpdateSchema.as_form),
    groupPicture: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        # if group doesn't exist
        result = await db.execute(
            select(Group).where(Group.id == group_id, Group.is_deleted.is_(False))
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

        is_new = False

        # if new group picture
        if groupPicture and groupPicture.filename:
            group_picture_public_id = upload_picture_on_cloudinary(
                file=groupPicture, folder="group_pictures"
            )
            existed_group.group_picture = group_picture_public_id

            delete_picture_from_cloudinary(existed_group.group_picture)

            is_new = True

        group_dict = group.model_dump(exclude_unset=True)

        # updating group info
        for key, val in group_dict.items():
            if getattr(existed_group, key) == val:
                continue

            setattr(existed_group, key, val)
            is_new = True

        # if genuinely new values inputed then create history record for GROUP_UPDATED
        if is_new:
            new_group_history = GroupHistory(
                group_id=group_id,
                action=GroupHistoryAction.GROUP_UPDATED,
                performed_by=current_user.id,
            )
            db.add(new_group_history)

        await db.commit()
    except:
        await db.rollback()
        raise

    return {"message": "Group updated successfully!"}


# * send additional invitations
@group_router.post("/{group_id}/invitations")
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

    return {"message": "Sent invitations successfully!"}


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


# * cancel group invitation
@group_router.delete("/invitations/{invitation_id}")
async def cancel_group_invitation_api(
    invitation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        # invitation not exist
        result = await db.execute(
            select(GroupInvitation)
            .join(GroupInvitation.group)
            .where(
                GroupInvitation.id == invitation_id,
                Group.is_deleted.is_(False),
            )
        )
        existed_invitation = result.scalars().one_or_none()

        if not existed_invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group invitation not found",
            )

        # you're not the inviter or the status is not pending
        if (
            existed_invitation.inviter_id != current_user.id
            or existed_invitation.status != InvitationStatus.PENDING
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to perform requested action",
            )

        # cancel the invitation
        existed_invitation.status = InvitationStatus.CANCELLED

        # creating group history
        new_group_history = GroupHistory(
            group_id=existed_invitation.group_id,
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
            action=GroupHistoryAction.GROUP_INVITATION_CANCELLED,
            performed_by=current_user.id,
        )
        db.add(new_group_history)

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return {"message": "Invitation cancelled successfully!"}


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


# * delete group
@group_router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_api(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # group not exist
    result = await db.execute(
        select(Group).where(Group.id == group_id, Group.is_deleted.is_(False))
    )
    existed_group = result.scalars().one_or_none()

    if not existed_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )

    # you're not admin
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role == GroupMemberRole.ADMIN,
        )
    )
    group_admin = result.scalars().one_or_none()

    if not group_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized to perform request action",
        )

    # get all group expenses
    result = await db.execute(select(Expense.id).where(Expense.group_id == group_id))
    expense_ids = result.scalars().all()

    expense_groups = await get_expense_groups(
        expense_ids=expense_ids, db=db, newest_first=True
    )

    for splits in expense_groups:
        settlement_groups = await get_settlement_groups(splits=splits, db=db)

        creditors = []
        debtors = []
        get_creditors_debtors(
            splits=splits,
            creditors=creditors,
            debtors=debtors,
            settlement_groups=settlement_groups,
        )

        if creditors or debtors:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete group until all balances are settled.",
            )

    existed_group.is_deleted = True
    await db.commit()

    return


# * leave group
@group_router.delete("/{group_id}/me", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group_api(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        # group not exist
        result = await db.execute(
            select(Group).where(Group.id == group_id, Group.is_deleted.is_(False))
        )
        existed_group = result.scalars().one_or_none()

        if not existed_group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )

        # you're not a member
        result = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id, GroupMember.user_id == current_user.id
            )
        )
        existed_member = result.scalars().one_or_none()

        if not existed_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to perform requested action",
            )

        # you've pending settlements
        result = await db.execute(
            select(Expense.id)
            .join(ExpenseSplits)
            .where(
                Expense.group_id == group_id, ExpenseSplits.user_id == current_user.id
            )
        )
        expense_ids = result.scalars().all()

        expense_groups = await get_expense_groups(
            expense_ids=expense_ids, db=db, newest_first=True
        )

        for splits in expense_groups:
            settlement_groups = await get_settlement_groups(splits=splits, db=db)

            creditors = []
            debtors = []
            get_creditors_debtors(
                splits=splits,
                creditors=creditors,
                debtors=debtors,
                settlement_groups=settlement_groups,
            )

            has_pending_settlements = any(
                creditor["user"].id == current_user.id for creditor in creditors
            ) or any(debtor["user"].id == current_user.id for debtor in debtors)

            if has_pending_settlements:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot leave group until all balances are settled.",
                )

        # get member count
        result = await db.execute(
            select(func.count())
            .select_from(GroupMember)
            .where(GroupMember.group_id == group_id)
        )
        member_count = result.scalar_one()

        # you're admin
        if existed_member.role == GroupMemberRole.ADMIN:

            # group has only one member
            if member_count == 1:
                existed_group.is_deleted = True

            # you've not transfered admin role
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Transfer admin role to another member before leaving the group.",
                )

        # leave
        await db.execute(
            delete(GroupMember).where(
                GroupMember.group_id == group_id, GroupMember.user_id == current_user.id
            )
        )

        # creating group history
        new_group_history = GroupHistory(
            group_id=group_id,
            action=GroupHistoryAction.MEMBER_LEFT,
            performed_by=current_user.id,
        )
        db.add(new_group_history)

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return


# * remove member
@group_router.delete(
    "/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_group_member_api(
    group_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        # group not exist
        result = await db.execute(
            select(Group).where(Group.id == group_id, Group.is_deleted.is_(False))
        )
        existed_group = result.scalars().one_or_none()

        if not existed_group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )

        # you're not admin
        result = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == current_user.id,
                GroupMember.role == GroupMemberRole.ADMIN,
            )
        )
        group_admin = result.scalars().one_or_none()

        if not group_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized to perform request action",
            )

        # admin wants to remove himself
        if user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Cannot remove yourself"
            )

        # user_id is not a member
        result = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id, GroupMember.user_id == user_id
            )
        )
        existed_member = result.scalars().one_or_none()

        if not existed_member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found",
            )

        # member has pending settlements
        result = await db.execute(
            select(Expense.id)
            .join(ExpenseSplits)
            .where(Expense.group_id == group_id, ExpenseSplits.user_id == user_id)
        )
        expense_ids = result.scalars().all()

        expense_groups = await get_expense_groups(
            expense_ids=expense_ids, db=db, newest_first=True
        )

        for splits in expense_groups:
            settlement_groups = await get_settlement_groups(splits=splits, db=db)

            creditors = []
            debtors = []
            get_creditors_debtors(
                splits=splits,
                creditors=creditors,
                debtors=debtors,
                settlement_groups=settlement_groups,
            )

            has_pending_settlements = any(
                creditor["user"].id == user_id for creditor in creditors
            ) or any(debtor["user"].id == user_id for debtor in debtors)

            if has_pending_settlements:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot remove group member until all balances are settled.",
                )

        # remove
        await db.execute(
            delete(GroupMember).where(
                GroupMember.group_id == group_id, GroupMember.user_id == user_id
            )
        )

        # creating group history
        new_group_history = GroupHistory(
            group_id=group_id,
            receiver_id=user_id,
            action=GroupHistoryAction.MEMBER_REMOVED,
            performed_by=current_user.id,
        )
        db.add(new_group_history)

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return


# * promote a member to admin
@group_router.patch("/{group_id}/members/{user_id}")
async def admin_transfered_api(
    group_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        # group not exist
        result = await db.execute(
            select(Group).where(Group.id == group_id, Group.is_deleted.is_(False))
        )
        existed_group = result.scalars().one_or_none()

        if not existed_group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )

        # you're not admin
        result = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == current_user.id,
                GroupMember.role == GroupMemberRole.ADMIN,
            )
        )
        group_admin = result.scalars().one_or_none()

        if not group_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized to perform request action",
            )

        # admin wants to be admin again
        if user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="User is already admin"
            )

        # user_id is not a member
        result = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id, GroupMember.user_id == user_id
            )
        )
        existed_member = result.scalars().one_or_none()

        if not existed_member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found",
            )
            
        existed_member.role = GroupMemberRole.ADMIN
        group_admin.role = GroupMemberRole.MEMBER
        
        # creating group history
        new_group_history = GroupHistory(
            group_id=group_id,
            receiver_id=user_id,
            action=GroupHistoryAction.ADMIN_TRANSFERRED,
            performed_by=current_user.id,
        )
        db.add(new_group_history)
        
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    
    return {"message" : f"{existed_member.name} has been promoted to admin successfully!"}
    