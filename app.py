from fastapi import FastAPI
from routers import auth_routers, friends_routers, expense_routers, settlements_router
from exception_handling.exception_handlers import handlers

app = FastAPI()

# back-end
app.include_router(auth_routers.auth_router)
app.include_router(friends_routers.friends_router)
app.include_router(expense_routers.expense_router)
app.include_router(settlements_router.settlements_router)

# exception handling
handlers(app)

