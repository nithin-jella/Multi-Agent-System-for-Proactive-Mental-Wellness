import os
import uuid
from typing import List, Dict, Any, Optional
import pinecone

import openai
from dataclasses import dataclass
import numpy as np
from datetime import datetime

from src.database import pinecone_conn
from src.service.llm import LLMService



@dataclass
class Document:
    """Document data structure"""
    content: str
    metadata: Dict[str, Any]
    doc_id: str = None
    
    def __post_init__(self):
        if self.doc_id is None:
            self.doc_id = str(uuid.uuid4())

class TextChunker:
    """Handles text chunking strategies"""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def chunk_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks"""
        if len(text) <= self.chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + self.chunk_size
            chunk = text[start:end]
            
            # Try to break at sentence boundary
            if end < len(text):
                last_period = chunk.rfind('.')
                last_newline = chunk.rfind('\n')
                break_point = max(last_period, last_newline)
                
                if break_point > start + self.chunk_size // 2:
                    chunk = text[start:start + break_point + 1]
                    end = start + break_point + 1
            
            chunks.append(chunk.strip())
            start = end - self.chunk_overlap
            
            if start >= len(text):
                break
                
        return chunks

class VectorDBService:
    """Vector database service using Pinecone"""
    
    def __init__(self, 
                 llm_service: LLMService,
                 ):
        self.pinecone_conn = pinecone_conn
        self.get_embeddings = llm_service.get_embeddings
        self.chunker = TextChunker()
        
    def chunk_documents(self, documents: List[Document]) -> List[Document]:
        """Chunk documents into smaller pieces"""
        chunked_docs = []
        
        for doc in documents:
            chunks = self.chunker.chunk_text(doc.content)
            
            for i, chunk in enumerate(chunks):
                chunked_doc = Document(
                    content=chunk,
                    metadata={
                        **doc.metadata,
                        "parent_doc_id": doc.doc_id,
                        "chunk_index": i,
                        "total_chunks": len(chunks),
                        "created_at": datetime.now().isoformat()
                    }
                )
                chunked_docs.append(chunked_doc)
        
        return chunked_docs
    
    async def add_documents(self, documents: List[Document]) -> Dict[str, Any]:
        """Add documents to Pinecone vector database"""
        try:
            print(f"Processing {len(documents)} documents...")
            
            # Chunk documents
            chunked_docs = self.chunk_documents(documents)
            print(f"Created {len(chunked_docs)} chunks")
            
            # Generate embeddings
            contents = [doc.content for doc in chunked_docs]
            embeddings = await self.get_embeddings(contents, task='RETRIEVAL_DOCUMENT')
            
            # Prepare vectors for upsert
            vectors = []
            for i, doc in enumerate(chunked_docs):
                vector = {
                    "id": doc.doc_id,
                    "values": embeddings[i],
                    "metadata": {
                        **doc.metadata,
                        "content": doc.content[:1000]  # Store first 1000 chars in metadata
                    }
                }
                vectors.append(vector)
            
            # Upsert to Pinecone (batch processing)
            batch_size = 100
            upserted_count = 0
            
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                self.pinecone_conn.index.upsert(vectors=batch)
                upserted_count += len(batch)
                print(f"Upserted {upserted_count}/{len(vectors)} vectors")
            
            return {
                "success": True,
                "message": f"Successfully added {len(chunked_docs)} document chunks",
                "chunks_added": len(chunked_docs),
                "documents_processed": len(documents)
            }
            
        except Exception as e:
            print(f"Error adding documents: {e}")
            return {
                "success": False,
                "message": f"Error adding documents: {str(e)}",
                "chunks_added": 0,
                "documents_processed": 0
            }
    
    async def retrieve_similar_documents(self, 
                                 query: str, 
                                 top_k: int = 5,
                                 filter_metadata: Optional[Dict] = None) -> List[Dict]:
        """Retrieve similar documents from Pinecone"""
        try:
            # Generate query embedding
            query_embedding = (await self.get_embeddings([query], task='RETRIEVAL_QUERY'))[0]
            
            # Search in Pinecone
            search_results = self.pinecone_conn.index.query(
                vector=query_embedding,
                top_k=top_k,
                include_metadata=True,
                filter=filter_metadata
            )
            
            # Format results
            retrieved_docs = []
            for match in search_results["matches"]:
                doc_data = {
                    "id": match["id"],
                    "score": match["score"],
                    "content": match["metadata"].get("content", ""),
                    "metadata": {k: v for k, v in match["metadata"].items() if k != "content"}
                }
                retrieved_docs.append(doc_data)
            
            return retrieved_docs
            
        except Exception as e:
            print(f"Error retrieving documents: {e}")
            return []
    
    
    def get_index_stats(self) -> Dict[str, Any]:
        """Get Pinecone index statistics"""
        try:
            stats = self.index.describe_index_stats()
            return {
                "total_vector_count": stats.get("total_vector_count", 0),
                "dimension": stats.get("dimension", 0),
                "index_fullness": stats.get("index_fullness", 0.0),
                "namespaces": stats.get("namespaces", {})
            }
        except Exception as e:
            return {"error": str(e)}