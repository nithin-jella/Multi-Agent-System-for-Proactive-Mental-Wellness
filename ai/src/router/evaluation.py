from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel
import logging
import os
import time
import asyncio
import aiofiles
from typing import List

from src.service.llm import LLMService
from src.service.graph import GraphService
from src.model.schema import Entity, Relation, EvaluationDataset


router = APIRouter()
logger = logging.getLogger(__name__)

async def get_llm_service():
  return LLMService()

async def get_graph_service():
  return GraphService(llm_service = await get_llm_service())


class GenerateEvaluationDatasetBody(BaseModel):
  chunk_ids: list[str]


@router.post("/generate-evaluation-dataset")
async def generate_evaluation_dataset(
  body: GenerateEvaluationDatasetBody = Body(...),
  llm_service: LLMService = Depends(get_llm_service),
  graph_service: GraphService = Depends(get_graph_service)
):
  try:
    chunk_ids = body.chunk_ids
    
    missing = [cid for cid in chunk_ids if not os.path.exists(f"./data/{cid}")]
    if missing:
      raise HTTPException(status_code=404, detail=f"Missing files: {missing}")
    

    async def process_chunk(chunk_id: str):
      try:
          # Load document
          logger.info(f"Start generate evaluation dataset for chunk {chunk_id}")
          async with aiofiles.open(f"./data/{chunk_id}", "r") as f:
              doc = await f.read()

          # Load related entities
          entities: List[Entity] = await graph_service.get_entities_chunk_id(chunk_id=chunk_id)

          # Generate evaluation dataset
          evaluation = await llm_service.generate_evaluation_dataset(
              doc=doc,
              nodes=entities,
              minimum = int(len(entities)/2)
          )

          return evaluation
      except Exception as e:
          logger.warning(f"Failed to process chunk {chunk_id}: {e}")
          return []  # or raise if you want to fail all
    
    tasks = [process_chunk(cid) for cid in chunk_ids]
    results = await asyncio.gather(*tasks)

    all_data = [item for dataset in results for item in dataset]

    return {
      "data": all_data
    }
  except HTTPException:
    raise
  except Exception as e:
    logger.exception(f"Failed to generate evaluation dataset: {e}")
    raise HTTPException(status_code=500, detail=str(e))