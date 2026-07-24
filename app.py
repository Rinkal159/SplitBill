from fastapi import FastAPI
from routers import (
    auth_routers,
    friends_routers,
    expense_routers,
    settlements_routers,
    history_routers,
    activities_routers,
    group_routers
)
from exception_handling.exception_handlers import handlers

app = FastAPI()

# back-end
app.include_router(auth_routers.auth_router)
app.include_router(friends_routers.friends_router)
app.include_router(expense_routers.expense_router)
app.include_router(settlements_routers.settlements_router)
app.include_router(history_routers.history_router)
app.include_router(activities_routers.activites_router)
app.include_router(group_routers.group_router)

# exception handling
handlers(app)
