from sqlalchemy import Column, Integer, DateTime
from datetime import datetime

class BaseModel:
    """Base model class that provides common columns and functionality"""
    
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)