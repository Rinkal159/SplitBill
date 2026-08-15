from fastapi import HTTPException, status
from backend_splitbill.auth.authentication import verify_token

def verify_reset_token(reset_token):
    # if not got the reset_token then OTP was not verified at first place
    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify through OTP before reseting password",
        )

    # get the payload
    payload = verify_token(reset_token)

    # if not the reset_token payload then it is invalid
    if payload.get("purpose") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid reset token"
        )
    
    return payload
