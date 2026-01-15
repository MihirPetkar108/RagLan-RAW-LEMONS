# =========================================================
# FORCE OFFLINE MODE (MUST BE FIRST)
# =========================================================
import os

os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"

# =========================================================
# IMPORTS
# =========================================================
import re
from dotenv import load_dotenv

from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, HumanMessage
from sentence_transformers import CrossEncoder

# =========================================================
# ENV
# =========================================================
load_dotenv()

# =========================================================
# VECTOR STORE
# =========================================================
embeddings = OllamaEmbeddings(
    model=os.getenv("EMBEDDING_MODEL")
)

db = FAISS.load_local(
    os.getenv("DATABASE_LOCATION"),
    embeddings,
    allow_dangerous_deserialization=True
)

# =========================================================
# RERANKER (OFFLINE SAFE)
# =========================================================
reranker = CrossEncoder(
    "/home/nomathematician/Aerothon26/models/ms-marco-MiniLM-L-6-v2",
    device="cuda",           # change to "cuda" if needed
    local_files_only=True
)

# =========================================================
# LLM (OLLAMA – OFFLINE SAFE)
# =========================================================
llm = init_chat_model(
    os.getenv("CHAT_MODEL"),
    model_provider=os.getenv("MODEL_PROVIDER"),
    temperature=0.0
)

# =========================================================
# CHAT STATE
# =========================================================
messages = [
    AIMessage("Ask questions strictly based on the uploaded document.")
]

# =========================================================
# GIBBERISH DETECTION
# =========================================================
def is_gibberish(text: str) -> bool:
    text = text.strip()

    if len(text) < 4:
        return True

    if " " not in text and len(text) > 12:
        return True

    if re.search(r"(.)\1{3,}", text):
        return True

    vowels = sum(1 for c in text.lower() if c in "aeiou")
    if vowels / max(len(text), 1) < 0.2:
        return True

    words = re.findall(r"[a-zA-Z]{3,}", text)
    if not words:
        return True

    return False

# =========================================================
# FOLLOW-UP HANDLING
# =========================================================
def needs_rewrite(q: str) -> bool:
    return (
        len(q.split()) <= 4 or
        q.lower().startswith(("and", "then", "what about", "make it"))
    )

def rewrite_query_with_history(question: str):
    user_questions = [
        m.content for m in messages
        if isinstance(m, HumanMessage)
    ]

    if not user_questions:
        return question

    previous_question = user_questions[-1]

    prompt = f"""
Rewrite the CURRENT QUESTION so it is fully self-contained.

Rules:
- Use the PREVIOUS QUESTION only for clarification
- Do NOT add new facts
- Do NOT answer the question
- Output ONLY the rewritten question

PREVIOUS QUESTION:
{previous_question}

CURRENT QUESTION:
{question}

REWRITTEN QUESTION:
"""

    rewritten = llm.invoke(prompt).content.strip()
    return rewritten if rewritten else question

# =========================================================
# RERANK INTENT
# =========================================================
def needs_rerank(query: str) -> bool:
    q = query.lower()
    return any(k in q for k in [
        "ticket", "booking", "travel", "passenger",
        "name", "details", "who", "list", "all"
    ])

# =========================================================
# RETRIEVAL
# =========================================================
def retrieve(query: str):
    dense_k = 25 if len(query.split()) >= 5 else 35
    dense = db.similarity_search(query, k=dense_k)

    if not needs_rerank(query) or len(query.split()) < 6:
        return dense[:8]

    dense = dense[:15]
    pairs = [[query, d.page_content] for d in dense]
    scores = reranker.predict(pairs)

    ranked = sorted(zip(scores, dense), key=lambda x: x[0], reverse=True)
    return [d for _, d in ranked[:8]]

# =========================================================
# MAIN QUERY HANDLER
# =========================================================
def answer_query(question: str, role="engineer", history=None) -> str:
    if history is None:
        history = []

    messages.clear()
    messages.append(AIMessage("Ask questions strictly based on the uploaded document."))

    for h in history:
        messages.append(HumanMessage(h["question"]))
        messages.append(AIMessage(h["answer"]))

    if is_gibberish(question):
        return "Invalid or unclear question. Please rephrase."

    messages.append(HumanMessage(question))

    safe_question = (
        rewrite_query_with_history(question)
        if needs_rewrite(question)
        else question
    )

    docs = retrieve(safe_question)

    context = ""
    for d in docs:
        src = os.path.basename(d.metadata.get("source", ""))
        page = d.metadata.get("page")
        context += (
            f"[{src} | Page {page + 1 if page is not None else '?'}]\n"
            f"{d.page_content}\n\n"
        )

    prompt = f"""
You must answer strictly from the document excerpts.

CONTEXT:
{context}

QUESTION:
{question}

ANSWER:
"""

    response = llm.invoke(prompt)
    return response.content.strip()
