from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel
from datetime import datetime
import logging
import time
import asyncio
import os

from src.service.data__ingestion import DataIngestion
from src.service.llm import LLMService
from src.service.graph import GraphService
from src.service.vector_db_service import VectorDBService, Document
from src.model.schema import EntityRelationResponse, Entity, Relation
from src.utils.extraction import remove_duplicates_by_keys, resolve_entities_with_merged_descriptions, remap_relations


router = APIRouter()
logger = logging.getLogger(__name__)
async def get_data_ingestion_service():
  return DataIngestion()

async def get_llm_service():
  return LLMService()

async def get_graph_service():
  return GraphService(llm_service = await get_llm_service())

async def get_vector_service():
  return VectorDBService(llm_service = await get_llm_service())

class ExtractEntitiesBody(BaseModel):
  file_path: str
  file_type: str
  split: bool = True

@router.post("/extract")
async def extract_entities_relations(
  body: ExtractEntitiesBody = Body(...),
  data_ingestion_service: DataIngestion = Depends(get_data_ingestion_service),
  llm_service: LLMService = Depends(get_llm_service),
  graph_service: GraphService = Depends(get_graph_service)
):
  """Extract entities from text"""
  start_time = time.time()

  try:
    file_path = body.file_path
    file_type = body.file_type
    split = body.split
    logger.info(f"{file_path}, {file_type}")
    logger.info("Entity  Relation Extraction Started")

    texts = data_ingestion_service.extract_text_from_files(file_path=file_path, type=file_type, split=split)



    chunk_data = []
    for index, text in enumerate(texts):
        file_base = os.path.splitext(os.path.basename(file_path))[0]
        file_name = f"{file_base}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_chunk{index+1}.txt"

        with open(f"./data/{file_name}", "w") as f:
            f.write(text)

        chunk_data.append((text, file_name))

    extraction_tasks = [llm_service.extract_entities_and_relations(text=text, chunk_id=file_name) for text, file_name in chunk_data]
    chunk_results: list[EntityRelationResponse] = await asyncio.gather(*extraction_tasks, return_exceptions=True)
    
    all_results = EntityRelationResponse(entities=[], relations=[])
    
    for res in chunk_results:
      if isinstance(res, Exception):
        logger.error(f"An error occurred during chunk extraction: {res}")
        continue
      if res:
        all_results.entities.extend(res.entities)
        all_results.relations.extend(res.relations)
  
    deduped_entities, entity_map = resolve_entities_with_merged_descriptions(entities=all_results.entities)
    remapped_relations = remap_relations(relations=all_results.relations, entity_name_map=entity_map)
    deduped_relations: list[Relation] = remove_duplicates_by_keys(remapped_relations, keys=["source_entity", "target_entity", "name", "type"])

    logger.info(f"Extracted {len(deduped_entities)} entities and {len(deduped_relations)} relations.")

    source_embedding = [
       f'{entity.name}, {entity.type}, {entity.description}'
       for entity in deduped_entities
       ]
    
    embeddings = await llm_service.get_embeddings(input=source_embedding, task="RETRIEVAL_DOCUMENT")

    for entity, embedding in zip(deduped_entities, embeddings):
      entity.embedding = embedding

    insert_entity = await graph_service.insert_entities(entities=deduped_entities)
    insert_relation = await graph_service.insert_relations(relations=deduped_relations)

    processing_time = time.time() - start_time
    return {
      "message": "successful",
      "processing_time": processing_time,
      "duplicate_entity": len(entity_map) - len(deduped_entities),
      "total_entities": len(deduped_entities),
      "total_relation": len(deduped_relations),
      "data": {
        "entities": deduped_entities,
        "relations": deduped_relations
        }
        }

  except Exception as e:
    logger.error(f"Fail to Extract Entities and Relations from Documen {body.file_path} : {str(e)}")
    raise HTTPException(status_code=500, detail=str(e))

class RAGExtractBody(BaseModel):
  file_path: str
  file_type: str
  chunk_size: int = 1000
  chunk_overlap: int = 200

class AddDocumentsResponse(BaseModel):
    success: bool
    message: str
    chunks_added: int
    documents_processed: int



@router.post("/extract-rag-vector")
async def add_document(
  body: RAGExtractBody = Body(...),
  data_ingestion_service: DataIngestion = Depends(get_data_ingestion_service),
  vector_service: VectorDBService = Depends(get_vector_service)
):
  try:

    file_path     = body.file_path
    file_type     = body.file_type
    chunk_size    = body.chunk_size
    chunk_overlap = body.chunk_overlap
    logger.info(f"{file_path}, {file_type}")
    logger.info("Add Document to Vector DB Started")

    input_docs = data_ingestion_service.extract_text_from_files(file_path=file_path, type=file_type, split=False)
    metadata = {
      "file_name": file_path
    }

    documents = []
    for doc_input in input_docs:
      doc = Document(
        content=doc_input,
        metadata=metadata,
        doc_id=file_path
        )
      documents.append(doc)
        
    result = await vector_service.add_documents(documents)
        
    return AddDocumentsResponse(**result)
  except Exception as e:
    logger.error(f"Fail to add document to RAG database: {e}")
    raise HTTPException(status_code=500, detail=str(e))