from pwdlib import PasswordHash

pwd_context = PasswordHash.recommended()

def hash(password: str) -> str:
    return pwd_context.hash(password)

def verify(plain_password: str, db_password: str) -> bool:
    return pwd_context.verify(plain_password, db_password)