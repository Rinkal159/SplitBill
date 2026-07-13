from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from model import engine

Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with Session() as db:
        yield db