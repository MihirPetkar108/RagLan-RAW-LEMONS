####################################################################################################
# app.py — FASTAPI RAG SERVER (AUTOMATED)
####################################################################################################

from fastapi import FastAPI, UploadFile, File, HTTPException
import shutil
import uuid
import os

from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings
from langchain.chat_models import init_chat_model

from dotenv import load_dotenv

from loading_pdfs import run_loader
from ingestion import run_ingestion


load_dotenv()

app = FastAPI(title="Local RAG with Ollama")

PDF_DIR = "pdfs"
os.makedirs(PDF_DIR, exist_ok=True)

_embeddings = None
_db = None
_llm = None


def load_rag():
    global _embeddings, _db, _llm

    if _db is not None:
        return

    _embeddings = OllamaEmbeddings(model=os.getenv("EMBEDDING_MODEL"))
    _db = FAISS.load_local(
        os.getenv("DATABASE_LOCATION"),
        _embeddings,
        allow_dangerous_deserialization=True
    )

    _llm = init_chat_model(
        os.getenv("CHAT_MODEL"),
        model_provider=os.getenv("MODEL_PROVIDER"),
        temperature=0.3
    )


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    filename = f"{uuid.uuid4()}.pdf"
    path = os.path.join(PDF_DIR, filename)

    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    run_loader()
    run_ingestion()

    global _db
    _db = None  # force reload after ingestion

    return {"status": "ingested", "file": filename}


@app.post("/chat")
async def chat(query: str):
    load_rag()

    docs = _db.similarity_search(query, k=6)
    context = "\n\n".join(d.page_content for d in docs)

    prompt = f"""
Use only the context below.

CONTEXT:
{context}

QUESTION:
{query}

ANSWER:
"""

    response = _llm.invoke(prompt)
    return {"answer": response.content}
