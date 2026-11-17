from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend_splitbill.auth.authentication import get_current_user
from backend_splitbill.database import get_db
from backend_splitbill.routers.expense_routers import (
    get_all_borrowing_and_lendings_api,
)
from backend_splitbill.routers.friends_routers import get_friends_api
from backend_splitbill.routers.group_routers import get_group_api
from backend_splitbill.schemas.dashboard_schema import DashboardBootstrapResponse


dashboard_router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@dashboard_router.get("", response_model=DashboardBootstrapResponse)
async def get_dashboard_bootstrap(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Load the data needed to render the initial dashboard and its sidebars."""
    return {
        "dashboard": await get_all_borrowing_and_lendings_api(db, current_user),
        "friends": await get_friends_api(db, current_user),
        "groups": await get_group_api(db, current_user),
    }
