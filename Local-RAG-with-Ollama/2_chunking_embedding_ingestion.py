####################################################################################################
# 2_chunking_embedding_ingestion.py — ABSOLUTELY SAFE, ACCURACY-FIRST
####################################################################################################

import os, json, re, shutil, multiprocessing
from dotenv import load_dotenv
from tqdm import tqdm
import tiktoken

from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

# ================= CONFIG =================

DB_PATH = os.getenv("DATABASE_LOCATION", "faiss_db")
DATASET_FILE = os.path.join(
    os.getenv("DATASET_STORAGE_FOLDER", "datasets"),
    "data.txt"
)

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL")

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# 🔒 VERY SAFE CAP (Ollama-proof)
MAX_TOKENS = 250
MAX_CHARS = 1500   # secondary hard guard

# ================= SETUP =================

encoder = tiktoken.get_encoding("cl100k_base")
embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)

splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=[
        "\n\n\n",
        "\n\n",
        "\n- ",
        "\n• ",
        "\n",
        ". ",
        " ",
        ""
    ]
)

# ================= HELPERS =================

def truncate_safe(text: str) -> str:
    # HARD character guard (prevents tokenizer mismatch issues)
    text = text[:MAX_CHARS]

    tokens = encoder.encode(text)
    return encoder.decode(tokens[:MAX_TOKENS])

def clean(text: str):
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 100 or text.count(" ") < 20:
        return None
    return text

def process(item):
    text = clean(item["text"])
    if not text:
        return []

    docs = splitter.create_documents(
        [text],
        metadatas=[{
            "source": item["source"],
            "page": item.get("page")
        }]
    )

    out = []
    for d in docs:
        d.page_content = truncate_safe(d.page_content)
        if len(d.page_content) >= 80:
            out.append(d)

    return out

# ================= INGESTION =================

def run_ingestion():
    if os.path.exists(DB_PATH):
        shutil.rmtree(DB_PATH)

    items = [
        json.loads(l)
        for l in open(DATASET_FILE, encoding="utf-8")
        if l.strip()
    ]

    with multiprocessing.Pool(min(6, multiprocessing.cpu_count())) as pool:
        results = list(tqdm(pool.imap(process, items), total=len(items)))

    docs = [d for sub in results for d in sub]
    if not docs:
        raise RuntimeError("❌ No chunks created")

    print(f"🔹 Total safe chunks: {len(docs)}")

    # ================= SAFE EMBEDDING (ONE-BY-ONE) =================

    db = None
    embedded = 0

    for doc in docs:
        try:
            if db is None:
                db = FAISS.from_documents([doc], embeddings)
            else:
                db.add_documents([doc])

            embedded += 1
            print(f"✓ Embedded {embedded}/{len(docs)}")

        except Exception as e:
            print("⚠️ Skipping chunk due to embedding error")
            continue

    if db is None:
        raise RuntimeError("❌ No embeddings succeeded")

    db.save_local(DB_PATH)

    print("\n✅ FAISS built successfully")
    print(f"📦 Embedded chunks: {embedded}")
    print(f"📁 DB Path: {DB_PATH}")

# ================= ENTRY =================

if __name__ == "__main__":
    run_ingestion()
