from sqlalchemy import select, update
from backend_splitbill.services.otp_generation import generate_otp
from backend_splitbill.services.email_generation import send_mail
from datetime import datetime, timedelta, UTC
from backend_splitbill.services.hash_password_otp import hash

from backend_splitbill.model import User, PasswordResetOTP

async def forgot_password(db, email):
    user = await db.execute(select(User).where(User.email == email.email))
    existed_user = user.scalars().one_or_none()

    if not existed_user:
        return {
            "message": "If an account exists, a password reset OTP has been sent to email."
        }

    # used = True for all previous otps sent to this mail
    await db.execute(
        update(PasswordResetOTP)
        .where(
            PasswordResetOTP.user_id == existed_user.id, PasswordResetOTP.used == False
        )
        .values(used=True)
    )

    # generate otp
    otp = generate_otp()

    # hash otp
    hashed_otp = hash(otp)

    # store otp in database
    new_otp = PasswordResetOTP(
        user_id=existed_user.id,
        otp=hashed_otp,
        expires_at=datetime.now(UTC) + timedelta(minutes=10),
    )
    db.add(new_otp)
    await db.commit()

    # send otp to email
    await send_mail(email.email, otp)

    return {
        "message": "If an account exists, a password reset OTP has been sent to email."
    }
