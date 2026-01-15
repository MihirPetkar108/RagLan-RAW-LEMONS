import os, json, re, shutil, multiprocessing
from dotenv import load_dotenv
from tqdm import tqdm
import tiktoken

from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

DB_PATH = os.getenv("DATABASE_LOCATION", "faiss_db")
DATASET_FILE = os.path.join(os.getenv("DATASET_STORAGE_FOLDER", "datasets"), "data.txt")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL")

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
MAX_TOKENS = 600

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

def truncate(text):
    return encoder.decode(encoder.encode(text)[:MAX_TOKENS])

def clean(text):
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
        d.page_content = truncate(d.page_content)
        if len(d.page_content) >= 80:
            out.append(d)
    return out

def ingest_documents():
    if os.path.exists(DB_PATH):
        shutil.rmtree(DB_PATH)

    items = [json.loads(l) for l in open(DATASET_FILE, encoding="utf-8") if l.strip()]

    with multiprocessing.Pool(min(8, multiprocessing.cpu_count())) as pool:
        results = list(tqdm(pool.imap(process, items), total=len(items)))

    docs = [d for sub in results for d in sub]
    if not docs:
        raise RuntimeError("No chunks created")

    db = FAISS.from_documents(docs[:500], embeddings)
    for i in range(500, len(docs), 500):
        db.add_documents(docs[i:i + 500])

    db.save_local(DB_PATH)
    print(f"✅ FAISS built | {len(docs)} chunks")
