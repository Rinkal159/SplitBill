from pydantic import BaseModel, Field, ConfigDict
from typing import Annotated
from decimal import Decimal
from datetime import date

class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class OverallSettlementCreate(Base):
    to_user: int
    amount: Annotated[Decimal, Field(
        gt=0
    )]
    settled_at: date