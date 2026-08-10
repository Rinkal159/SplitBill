from fastapi_mail import FastMail, MessageSchema, MessageType
from backend_splitbill.services.email_config import config

async def send_mail(email, otp):
    message = MessageSchema(
        subject="Password Reset",
        recipients=[email],
        body=f"""
Hello,

Your SplitBill password reset verification code is:

{otp}

This code expires in 10 minutes.

If you didn't create this account, please ignore this email.
""",
        subtype=MessageType.plain,
    )
    
    mail = FastMail(config)
    await mail.send_message(message)
    
    