from fastapi import APIRouter, HTTPException, Depends, Body
import logging
import time
from typing import Literal, Optional, List, Dict
from pydantic import BaseModel

from src.service.llm import LLMService
from src.service.graph import GraphService
from src.service.vector_db_service import VectorDBService

async def get_llm_service():
  return LLMService()

async def get_graph_service():
  return GraphService(llm_service=await get_llm_service())

async def get_vector_service():
  return VectorDBService(llm_service = await get_llm_service())


logger = logging.getLogger(__name__)

router = APIRouter()

def extract_one_hop_bfs_graph_to_knowlwdge(graph: list[dict]) -> str:
  try:
      description = {}
      knowledge_set = set()

      for fact in graph:
          if fact["central_name"] not in description:
              description[fact['central_name']] = fact['central_description'] or ""
          if fact['neighbor_name'] not in description:
              description[fact['neighbor_name']] = fact['neighbor_description'] or ""

          relation = fact.get("relation_name", "terkait_dengan")

          if fact['direction'] == "OUTGOING":
              line = f"{fact['central_name']} {relation} {fact['neighbor_name']}"
          else:
              line = f"{fact['neighbor_name']} {relation} {fact['central_name']}"

          knowledge_set.add(line)

      description_lines = [f"- {name}: {desc}" for name, desc in description.items()]

      description_text = "Deskripsi:\n" + "\n".join(description_lines)
      facts_text = "Fakta:\n" + "\n".join(sorted(knowledge_set))

      knowledge = f"{description_text}\n\n{facts_text}"
      return knowledge
  except Exception as e:
     return ""
def transform_graph_to_knowledge_text(graph_results: list[dict], desc_limit: int = 100) -> str:
    """
    Transforms nested graph results into a rich, LLM-friendly knowledge text,
    including truncated neighbor descriptions.
    """
    if not graph_results:
        return ""

    knowledge_blocks = []
    for item in graph_results:
        central_name = item.get('central_name', 'N/A')
        central_type = item.get('central_type', 'N/A')
        central_desc = item.get('central_description', 'Tidak ada deskripsi.')
        score = item.get('score', 0.0)

        block = [
            f"### Entitas: {central_name} (Tipe: {central_type})",
            f"- Deskripsi: {central_desc}",
            f"- Skor Relevansi Awal: {score:.2f}",
            "- Hubungan Terkait:"
        ]

        neighborhood = item.get('neighborhood', [])
        if not any(n.get('neighbor') for n in neighborhood):
            block.append("  - Tidak ditemukan hubungan terkait.")
        else:
            for relation_info in neighborhood:
                neighbor = relation_info.get('neighbor', {})
                relation = relation_info.get('relation', {})
                
                neighbor_name = neighbor.get('name', 'N/A')
                neighbor_type = neighbor.get('type', 'N/A')
                # MENAMBAHKAN DESKRIPSI TETANGGA
                neighbor_desc = neighbor.get('description', '')
                if neighbor_desc and len(neighbor_desc) > desc_limit:
                    neighbor_desc = neighbor_desc[:desc_limit] + "..."
                
                relation_name = relation.get('name', 'terkait dengan')
                relation_type = relation.get('type', 'TERKAIT_DENGAN')
                direction = relation.get('direction', 'OUTGOING')

                desc_part = f" | Deskripsi: \"{neighbor_desc}\"" if neighbor_desc else ""
                
                if direction == 'OUTGOING':
                    line = f"  - [OUTGOING] --[{relation_name}|Tipe: {relation_type}]--> {neighbor_name} (Tipe: {neighbor_type}{desc_part})"
                else:
                    line = f"  - [INCOMING] <--[{relation_name}|Tipe: {relation_type}]-- {neighbor_name} (Tipe: {neighbor_type}{desc_part})"
                
                block.append(line)
        
        knowledge_blocks.append("\n".join(block))

    header = "Berikut adalah informasi yang ditemukan dari knowledge graph:\n"
    return header + "\n\n".join(knowledge_blocks)

def parse_central_neighbor_knowledge_enhanced(graph_results: list[dict], desc_limit: int = 200) -> str:
    """
    Transforms central-neighbor graph results into clean, minimal knowledge text.
    
    Args:
        graph_results: List of graph result dictionaries with central entity and neighbors
        desc_limit: Maximum character limit for neighbor descriptions
        
    Returns:
        Formatted knowledge string with central entities and their neighborhoods
    """
    if not graph_results:
        return ""

    try:
        knowledge_blocks = []
        
        for item_idx, item in enumerate(graph_results):
            try:
                # Extract central entity information
                central_name = item.get('central_name', 'N/A')
                central_type = item.get('central_type', 'N/A') 
                central_desc = item.get('central_description', 'Tidak ada deskripsi.')
                score = item.get('score', 0.0)

                # Build central entity block
                block = [
                    f"Entitas: {central_name} ({central_type})",
                    f"Deskripsi: {central_desc}",
                    f"Skor: {score:.2f}",
                    "Hubungan:"
                ]

                # Process neighborhood
                neighborhood = item.get('neighborhood', [])
                valid_neighbors = [n for n in neighborhood if n.get('neighbor')]
                
                if not valid_neighbors:
                    block.append("  Tidak ada hubungan terkait.")
                else:
                    for relation_info in valid_neighbors:
                        try:
                            neighbor = relation_info.get('neighbor', {})
                            relation = relation_info.get('relation', {})
                            
                            # Extract neighbor information
                            neighbor_name = neighbor.get('name', 'N/A')
                            neighbor_type = neighbor.get('type', 'N/A')
                            neighbor_desc = neighbor.get('description', '').strip()
                            
                            # Truncate description if needed
                            if neighbor_desc and len(neighbor_desc) > desc_limit:
                                neighbor_desc = neighbor_desc[:desc_limit].rstrip() + "..."
                            
                            # Extract relationship information
                            relation_name = relation.get('name', 'terkait dengan')
                            direction = relation.get('direction', 'OUTGOING')

                            # Build description part
                            desc_part = f" | {neighbor_desc}" if neighbor_desc else ""
                            
                            # Build relationship line based on direction
                            if direction == 'OUTGOING':
                                line = f"  {central_name} --[{relation_name}]--> {neighbor_name} ({neighbor_type}){desc_part}"
                            else:
                                line = f"  {neighbor_name} ({neighbor_type}) --[{relation_name}]--> {central_name}{desc_part}"
                            
                            block.append(line)
                            
                        except Exception as e:
                            logger.warning(f"Error processing neighbor in item {item_idx}: {e}")
                            continue
                
                knowledge_blocks.append("\n".join(block))
                
            except Exception as e:
                logger.error(f"Error processing graph item {item_idx}: {e}")
                continue

        if not knowledge_blocks:
            return ""

        return "Informasi dari knowledge graph:\n\n" + "\n\n".join(knowledge_blocks)
        
    except Exception as e:
        logger.error(f"Failed to parse central-neighbor graph: {e}")
        return ""

def parse_full_path_knowledge(paths: list[dict]) -> str:
    """
    Enhanced version with detailed logging and error handling.
    """
    try:
        descriptions = {}
        fact_lines = set()
        
        logger.info(f"Processing {len(paths)} paths")

        for path_idx, path in enumerate(paths):
            try:
                nodes = path.get("path_nodes", [])
                rels = path.get("path_rels", [])
                
                logger.debug(f"Path {path_idx}: {len(nodes)} nodes, {len(rels)} relationships")

                # Validate path structure
                if not nodes:
                    logger.warning(f"Path {path_idx}: No nodes found")
                    continue
                    
                if len(nodes) >= 2 and len(rels) != len(nodes) - 1:
                    logger.warning(f"Path {path_idx}: Mismatch between nodes ({len(nodes)}) and relationships ({len(rels)})")

                # 1. Collect descriptions
                for node_idx, node in enumerate(nodes):
                    name = node.get("name", "").strip()
                    desc = node.get("description", "").strip()
                    node_type = node.get("type", "")
                    
                    if not name:
                        logger.warning(f"Path {path_idx}, Node {node_idx}: Missing name")
                        continue
                        
                    if desc and name not in descriptions:
                        descriptions[name] = desc
                        logger.debug(f"Added description for '{name}': {desc[:50]}...")

                # 2. Build path fact
                if len(nodes) >= 2 and rels:
                    path_components = []
                    
                    for i in range(min(len(rels), len(nodes) - 1)):
                        # Current node
                        current_node = nodes[i].get("name", "").strip()
                        if not current_node:
                            logger.warning(f"Path {path_idx}: Empty node name at position {i}")
                            current_node = f"Node_{i}"
                        
                        path_components.append(current_node)
                        
                        # Relationship
                        relation = rels[i].get("name", "terhubung").strip() or "terhubung"
                        direction = rels[i].get("direction", "OUTGOING")
                        
                        if direction == "OUTGOING":
                            path_components.append(f"--[{relation}]-->")
                        else:
                            path_components.append(f"<--[{relation}]--")
                    
                    # Final node
                    final_node = nodes[-1].get("name", "").strip()
                    if final_node:
                        path_components.append(final_node)
                    else:
                        logger.warning(f"Path {path_idx}: Empty final node name")
                        path_components.append("Node_final")
                    
                    # Create path string
                    path_str = " ".join(path_components)
                    fact_lines.add(path_str)
                    logger.debug(f"Added path fact: {path_str}")
                    
            except Exception as e:
                logger.error(f"Error processing path {path_idx}: {e}")
                continue

        # Format output
        result_parts = []
        
        if descriptions:
            desc_lines = [f"{name}: {desc}" for name, desc in sorted(descriptions.items())]
            result_parts.append("Deskripsi:\n" + "\n".join(desc_lines))
            logger.info(f"Added {len(descriptions)} descriptions")
        
        if fact_lines:
            result_parts.append("Fakta:\n" + "\n".join(sorted(fact_lines)))
            logger.info(f"Added {len(fact_lines)} facts")
        
        result = "\n\n".join(result_parts) if result_parts else ""
        logger.info(f"Generated knowledge string: {len(result)} characters")
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to parse path response: {e}")
        return ""


class GetAnswerBody(BaseModel):
  query: str
  graph_traversal: Literal[
     'neighbor_expansion',
     'n-shortest_path',
     'auto'
     ] = 'auto'
  search_method: Literal['vector', 'auto'] = 'auto'
  max_hop: Optional[int] = 10
  limit: Optional[int] = 50
  top_k: Optional[int] = 3

@router.post("/get-answer")
async def get_answer(
  body: GetAnswerBody = Body(...),
  graph_service: GraphService = Depends(get_graph_service),
  llm_service: LLMService = Depends(get_llm_service)
):
  try:
    start = time.perf_counter()

    query           = body.query
    graph_traversal = body.graph_traversal
    max_hop         = body.max_hop
    limit           = body.limit
    top_k           = body.top_k
    search_method   = body.search_method

    query_class  = await llm_service.query_classification(query=query)
    candidate_entities = query_class.get("entities", [])
    query_category = query_class.get("category", "entity_query")

    result: dict      = {}
    graph: list[dict] = []
    knowledge: list   = ""

    if graph_traversal != "auto":
        graph_traversal_map = {
            "neighbor_expansion": lambda: graph_service.NeighborExpansion(query=query, candidate_entities=candidate_entities, limit=limit, top_k=top_k, search_method=search_method),
            "n-shortest_path": lambda: graph_service.N_ShortestPath(query=query, candidate_entities=candidate_entities, max_hop=max_hop, paths_per_group=5, top_k=top_k, search_method=search_method),
        }

        if graph_traversal not in graph_traversal_map:
            raise HTTPException(status_code=400, detail=f"Unknown graph_traversal method: {graph_traversal}")

        graph = await graph_traversal_map[graph_traversal]()

        # Parsing step
        if graph_traversal == 'neighbor_expansion':
            knowledge = transform_graph_to_knowledge_text(graph_results=graph, desc_limit=1000)
        else:
            knowledge = parse_full_path_knowledge(paths=graph)

    else:
        if query_category == "path_query":
            graph = await graph_service.N_ShortestPath(query=query, candidate_entities=candidate_entities, max_hop=max_hop, paths_per_group=5, top_k=top_k, search_method=search_method)
            if len(graph) <= 0:
                graph = await graph_service.NeighborExpansion(query=query, candidate_entities=candidate_entities, limit=limit, top_k=top_k, search_method=search_method)
                knowledge = transform_graph_to_knowledge_text(graph_results=graph, desc_limit=1000)
                graph_traversal = "neighbor_expansion"
                logger.warning("Failed to find path, fallback to neighbor expansion")
            else:
                knowledge = parse_full_path_knowledge(paths=graph)
                graph_traversal = "n-shortest_path"
        else:
            graph = await graph_service.NeighborExpansion(query=query, candidate_entities=candidate_entities, limit=limit, top_k=top_k, search_method=search_method)
            knowledge = transform_graph_to_knowledge_text(graph_results=graph, desc_limit=1000)
            graph_traversal = "neighbor_expansion"


    answer = await llm_service.answer_query_with_knowledge_retrieval(query=query, knowledge=knowledge)
    end = time.perf_counter()
    result['latency']           = round(end-start, 4)
    result['graph_traversal']   = graph_traversal
    result['query_class']       = query_class
    result['answer']            = answer
    result['knowledge']         = knowledge
    result['graph']             = graph


    return{
      "message": "Sucessfull",
      "data": result
    }

  except Exception as e:
    logger.error(f"Error Get answer{e}")
    raise HTTPException(500, detail=str(e))

class QueryRequest(BaseModel):
    question: str
    top_k: Optional[int] = 5
    filter_metadata: Optional[Dict] = None

class RetrievedDocument(BaseModel):
    id: str
    score: float
    content: str
    metadata: Dict

class QueryResponse(BaseModel):
    question: str
    answer: str
    retrieved_documents: List[RetrievedDocument]
    sources: List[str]
    confidence_scores: List[float]
    latency: float


class GetAnswerRAGVectorBody(BaseModel):
    query: str
    top_k: int = 5

@router.post("/get-answer-vector-rag")
async def get_answer_rag_vector(
    body: GetAnswerRAGVectorBody = Body(...),
    vector_service: VectorDBService = Depends(get_vector_service),
    llm_service: LLMService = Depends(get_llm_service)
):
    try:
        start = time.perf_counter()
        query = body.query
        top_k = body.top_k
        # Retrieve similar documents
        retrieved_docs = await vector_service.retrieve_similar_documents(
            query=query,
            top_k=top_k
        )
        
        if not retrieved_docs:
            raise HTTPException(
                status_code=404, 
                detail="No relevant documents found for the query"
            )
        
        # Generate response
        answer = await llm_service.generate_response_rag_vector(query=query, retrieved_docs=retrieved_docs)
        
        # Format response
        retrieved_documents = [
            RetrievedDocument(
                id=doc["id"],
                score=doc["score"],
                content=doc["content"],
                metadata=doc["metadata"]
            )
            for doc in retrieved_docs
        ]
        
        sources = list(set([
            doc["metadata"].get("source", "Unknown") 
            for doc in retrieved_docs
        ]))
        
        confidence_scores = [doc["score"] for doc in retrieved_docs]
        end = time.perf_counter()
        
        return QueryResponse(
            question=query,
            answer=answer,
            retrieved_documents=retrieved_documents,
            sources=sources,
            confidence_scores=confidence_scores,
            latency=round(end-start, 4)
        )

    except Exception as e:
        logger.error(f"Error Get answer{e}")
        raise HTTPException(500, detail=str(e))