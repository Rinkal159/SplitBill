from pwdlib import PasswordHash

pwd_context = PasswordHash.recommended()

def hash(val: str) -> str:
    return pwd_context.hash(val)

def verify(plain_val: str, db_val: str) -> bool:
    return pwd_context.verify(plain_val, db_val)