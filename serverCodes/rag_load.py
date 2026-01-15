import os, json, glob
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from ocr_utils import ocr_pdf

load_dotenv()

PDF_FOLDER = "/home/nomathematician/Aerothon26/Local-RAG-with-Ollama/pdfs/engineering"
DATASET_FOLDER = os.getenv("DATASET_STORAGE_FOLDER", "datasets")
OUTPUT_FILE = os.path.join(DATASET_FOLDER, "data.txt")

os.makedirs(PDF_FOLDER, exist_ok=True)
os.makedirs(DATASET_FOLDER, exist_ok=True)

def load_documents():
    if os.path.exists(OUTPUT_FILE):
        os.remove(OUTPUT_FILE)

    files = (
        glob.glob(f"{PDF_FOLDER}/*.pdf") +
        glob.glob(f"{PDF_FOLDER}/*.txt") +
        glob.glob(f"{PDF_FOLDER}/*.docx")
    )

    if not files:
        raise RuntimeError("No files found")

    count = 0

    for path in files:
        # ---------------- TXT ----------------
        if path.endswith(".txt"):
            text = open(path, encoding="utf-8", errors="ignore").read()
            if text.count(" ") < 20:
                continue
            records = [{"source": path, "text": text}]

        # ---------------- DOCX ----------------
        elif path.endswith(".docx"):
            text = Docx2txtLoader(path).load()[0].page_content
            if text.count(" ") < 20:
                continue
            records = [{"source": path, "text": text}]

        # ---------------- PDF ----------------
        else:
            records = []
            pages = []

            # 🔹 Try normal PDF parsing
            try:
                pages = PyPDFLoader(path).load()
            except Exception as e:
                print(f"⚠️ PyPDFLoader failed, will try OCR: {os.path.basename(path)} | {e}")

            # 🔹 Use extracted text if available
            for d in pages:
                if not d.page_content:
                    continue
                if d.page_content.count(" ") < 20:
                    continue

                records.append({
                    "source": path,
                    "page": d.metadata.get("page"),
                    "text": d.page_content
                })

            # 🔹 Fallback to OCR if no usable text
            if not records:
                try:
                    ocr_text = ocr_pdf(path)
                    if ocr_text and ocr_text.count(" ") >= 20:
                        records.append({
                            "source": path,
                            "page": None,
                            "text": ocr_text
                        })
                        print(f"🧠 OCR used for: {os.path.basename(path)}")
                except Exception as e:
                    print(f"❌ OCR failed: {os.path.basename(path)} | {e}")

        # ---------------- WRITE ----------------
        for r in records:
            with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
            count += 1

    print(f"✅ Loaded {count} text blocks")
