from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime


class Entity(BaseModel):
    id: Optional[str] = None
    chunk_id: Optional[str] = None
    name: str
    type: Optional[str] = None
    description: str
    embedding: Optional[list[float]] = None

class Relation(BaseModel):
    id: Optional[str] = None
    chunk_id: Optional[str] = None
    source_entity: str
    target_entity: str
    name: str
    type: str

class EntityRelation(BaseModel):
    entities: List[Entity]
    relations: List[Relation]

class QueryClassification(BaseModel):
    category: str
    entities : List[str]

class EntityRelationResponse(BaseModel):
    entities: list[Entity]
    relations: list[Relation]


class EvaluationDataset(BaseModel):
    id: Optional[str] = None
    query: str
    query_lable: str
    golden_nodes: List[str]
    golden_answer: str

# Document models
class Document(BaseModel):
    id: Optional[str] = None
    content: str
    metadata: Optional[Dict[str, Any]] = {}
    created_at: Optional[datetime] = None

class DocumentProcessRequest(BaseModel):
    content: str
    metadata: Optional[Dict[str, Any]] = {}
    extract_entities: bool = True
    extract_relations: bool = True

# Query models
class GraphQuery(BaseModel):
    query: str
    limit: Optional[int] = 10
    include_context: bool = True

class QueryResponse(BaseModel):
    answer: str
    relevant_entities: List[Entity]
    relevant_relations: List[Relation]
    source_documents: List[str]
    confidence: float
