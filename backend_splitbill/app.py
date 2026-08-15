from fastapi import FastAPI
from backend_splitbill.routers import activities_routers, auth_routers, expense_routers, friends_routers, group_routers, history_routers, profile_routers
from backend_splitbill.routers import (
    settlements_routers
)
from backend_splitbill.exception_handling.exception_handlers import handlers
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# cors error solution
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

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
