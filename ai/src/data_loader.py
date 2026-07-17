import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
from dotenv import load_dotenv
import sys

# Add backend directory to path to import models
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'backend')))

from app.models import ContentResource

class DataLoader:
    def __init__(self):
        load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
        self.db_url = os.getenv("DATABASE_URL")
        if self.db_url and self.db_url.startswith("postgresql://"):
            self.db_url = self.db_url.replace("postgresql://", "postgresql+asyncpg://")
        
        if not self.db_url:
            raise ValueError("DATABASE_URL not found in .env file")

        self.engine = create_async_engine(self.db_url, echo=False)
        self.async_session = async_sessionmaker(self.engine, expire_on_commit=False, class_=AsyncSession)

    async def _load_from_db(self) -> list[str]:
        documents = []
        async with self.async_session() as session:
            result = await session.execute(
                select(ContentResource).where(ContentResource.embedding_status == 'succeeded')
            )
            resources = result.scalars().all()
            for resource in resources:
                documents.append(resource.content)
        return documents

    def load_data(self) -> list[str]:
        return asyncio.run(self._load_from_db())

if __name__ == '__main__':
    loader = DataLoader()
    docs = loader.load_data()
    for doc in docs:
        print(doc[:100] + "...")
