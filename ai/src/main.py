from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import uvicorn

from src.config import Config
from src.database import init_database
from src.router import extraction, retrieval, evaluation


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application startup...")
    await init_database()

    yield



app = FastAPI(
  title="Alika AI Engine",
  description="AI Engine for Alika Chatbot",
  version="1.0.0",
  lifespan=lifespan
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(extraction.router, prefix="/api/v1/extraction", tags=["extraction"])
app.include_router(retrieval.router, prefix="/api/v1/retrieval", tags=["retrieval"])
app.include_router(evaluation.router, prefix="/api/v1/evaluation", tags=["evaluation"])

@app.get("/")
async def root():
    return {"message": "Graph-based RAG AI Service", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}


def create_graph(tx):
    tx.run("""
        MERGE (d:Disorder {name: "Depression", desc: "A mood disorder causing persistent sadness."})
        MERGE (a:Disorder {name: "Anxiety", desc: "A condition marked by excessive fear or worry."})
        MERGE (i:Symptom {name: "Insomnia", desc: "Difficulty falling or staying asleep."})
        MERGE (t:Treatment {name: "CBT", desc: "Cognitive Behavioral Therapy, a common treatment."})
        MERGE (p:Professional {name: "Psychologist", desc: "A professional providing therapy."})

        MERGE (d)-[:HAS_SYMPTOM]->(i)
        MERGE (a)-[:HAS_SYMPTOM]->(i)
        MERGE (d)-[:TREATED_BY]->(t)
        MERGE (a)-[:TREATED_BY]->(t)
        MERGE (t)-[:PROVIDED_BY]->(p)
    """)

# === RETRIEVE GRAPH CONTEXT FOR ENTITY ===
def get_context(tx, term):
    query = """
    MATCH (n)-[r]-(m)
    WHERE toLower(n.name) CONTAINS toLower($term)
    RETURN n.name AS node, n.desc AS node_desc, type(r) AS relation, m.name AS related, m.desc AS related_desc
    LIMIT 10
    """
    result = tx.run(query, term=term)
    context = ""
    for record in result:
        context += f"{record['node']}: {record['node_desc']}\n"
        context += f"→ {record['relation']} → {record['related']}: {record['related_desc']}\n\n"
    return context

def start():
    port = int(Config.PORT)
    print(port)
    uvicorn.run(app=app, host="0.0.0.0", port=port)
# For Render deployment
if __name__ == "__main__":
    start()