from pydantic import BaseModel, Field, ConfigDict, ValidationError
from typing import Annotated
from fastapi import Form
from fastapi.exceptions import RequestValidationError


class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# * ProfileUpdate
class ProfileUpdate(Base):
    name: Annotated[str | None, Field(min_length=4, max_length=100)] = None
    mobile_number: Annotated[
        str | None, Field(min_length=10, max_length=10, pattern=r"^\d{10}$")
    ] = None

    @classmethod
    def as_form(
        cls,
        name: str | None = Form(None),
        mobile_number: str | None = Form(None),
    ):
        try:
            form_values = {}
            if name is not None:
                form_values["name"] = name
            if mobile_number is not None:
                form_values["mobile_number"] = mobile_number or None
            return cls(**form_values)
        except ValidationError as e:
            raise RequestValidationError(e.errors())


# * ChangePassword
class ChangePassword(Base):
    current_password: str
    new_password: Annotated[str, Field(min_length=8)]
    confirm_password: str
