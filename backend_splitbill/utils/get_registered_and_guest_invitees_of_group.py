from fastapi import HTTPException, status
from Backend_SplitBill.model import User
from sqlalchemy import select, or_

async def get_registered_and_guest_invitees_of_group(group, db):
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
        
    # get existed invitees
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
    
    return existed_invitees, non_registered_emails, non_registered_mobile_numbers
