from fastapi import FastAPI
from Backend_SplitBill.routers import activities_routers, auth_routers, expense_routers, friends_routers, group_routers, history_routers, profile_routers
from Backend_SplitBill.routers import (
    settlements_routers
)
from Backend_SplitBill.exception_handling.exception_handlers import handlers

app = FastAPI()

# back-end
app.include_router(auth_routers.auth_router)
app.include_router(profile_routers.profile_router)
app.include_router(friends_routers.friends_router)
app.include_router(expense_routers.expense_router)
app.include_router(settlements_routers.settlements_router)
app.include_router(history_routers.history_router)
app.include_router(activities_routers.activites_router)
app.include_router(group_routers.group_router)

# exception handling
handlers(app)
