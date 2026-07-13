from fastapi import HTTPException

def raise_exception(status_code: int, detail: str):
    raise HTTPException(status_code=status_code, detail=detail)