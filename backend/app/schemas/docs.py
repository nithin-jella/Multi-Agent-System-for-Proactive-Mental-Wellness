# backend/app/schemas/docs.py
from pydantic import BaseModel, ConfigDict
from typing import Dict, List, Optional, Any

#? --- Docs Schemas ---
# Documentation models
class EndpointExample(BaseModel):
    """Example request and response for an endpoint"""
    request: Optional[Dict[str, Any]] = None
    response: Optional[Dict[str, Any]] = None
    description: Optional[str] = None

class EndpointDoc(BaseModel):
    """Documentation for a specific endpoint"""
    path: str
    method: str
    summary: str
    description: str
    parameters: List[Dict[str, Any]] = []
    request_body: Optional[Dict[str, Any]] = None
    responses: Dict[str, Any]
    examples: List[EndpointExample] = []

class ModuleDoc(BaseModel):
    """Documentation for a module of related endpoints"""
    name: str
    description: str
    endpoints: List[EndpointDoc]