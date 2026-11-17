from pydantic import BaseModel, ConfigDict, Field

from backend_splitbill.schemas.expense_schema import (
    BorrowingsAndLendings as BorrowingsAndLendingsSchema,
)
from backend_splitbill.schemas.friends_schema import (
    InvitationSentResponse as InvitationSentResponseSchema,
    UserDetail as UserDetailSchema,
)
from backend_splitbill.schemas.group_schema import (
    GroupResponse as GroupResponseSchema,
    SentInvitationRespose as SentGroupInvitationResponseSchema,
)
from backend_splitbill.schemas.settlement_schema import (
    SettlementRequestResponse as SettlementRequestResponseSchema,
)


class DashboardBootstrapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    dashboard: BorrowingsAndLendingsSchema
    friends: list[UserDetailSchema]
    groups: list[GroupResponseSchema]
    sent_friend_invitations: list[InvitationSentResponseSchema] = Field(default_factory=list)
    sent_group_invitations: list[SentGroupInvitationResponseSchema] = Field(default_factory=list)
    sent_settlement_requests: list[SettlementRequestResponseSchema] = Field(default_factory=list)
