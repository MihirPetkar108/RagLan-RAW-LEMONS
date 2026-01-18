####################################################################################################
# 1_loading_pdfs.py — ROBUST PDF/TXT/DOCX LOADER WITH FORCED OCR
####################################################################################################

import os
import json
import glob
from dotenv import load_dotenv

from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader

from pdf2image import convert_from_path
import pytesseract

load_dotenv()

####################################################################################################
# CONFIG
####################################################################################################

PDF_FOLDER = os.getenv("PDF_FOLDER", "pdfs")
DATASET_FOLDER = os.getenv("DATASET_STORAGE_FOLDER", "datasets")
OUTPUT_FILE = os.path.join(DATASET_FOLDER, "data.txt")

# Windows-safe Tesseract path (override via .env if needed)
pytesseract.pytesseract.tesseract_cmd = (
    os.getenv("TESSERACT_PATH")
    or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

os.makedirs(PDF_FOLDER, exist_ok=True)
os.makedirs(DATASET_FOLDER, exist_ok=True)

####################################################################################################
# MAIN LOADER
####################################################################################################

def run_loader():
    if os.path.exists(OUTPUT_FILE):
        os.remove(OUTPUT_FILE)

    files = (
        glob.glob(f"{PDF_FOLDER}/*.pdf")
        + glob.glob(f"{PDF_FOLDER}/*.txt")
        + glob.glob(f"{PDF_FOLDER}/*.docx")
    )

    if not files:
        raise RuntimeError("❌ No files found")

    total_blocks = 0

    for path in files:
        filename = os.path.basename(path)
        print(f"📄 Processing: {filename}")

        records = []

        # ================= TXT =================
        if path.endswith(".txt"):
            text = open(path, encoding="utf-8", errors="ignore").read()
            if text.count(" ") >= 20:
                records.append({
                    "source": path,
                    "text": text
                })

        # ================= DOCX =================
        elif path.endswith(".docx"):
            text = Docx2txtLoader(path).load()[0].page_content
            if text.count(" ") >= 20:
                records.append({
                    "source": path,
                    "text": text
                })

        # ================= PDF =================
        else:
            # ---------- TRY PyPDF ----------
            pdf_docs = []
            try:
                pdf_docs = PyPDFLoader(path).load()
            except Exception:
                pdf_docs = []

            for d in pdf_docs:
                if d.page_content.count(" ") < 20:
                    continue
                records.append({
                    "source": path,
                    "page": d.metadata.get("page"),
                    "text": d.page_content
                })

            # ---------- FORCE OCR IF NO USABLE TEXT ----------
            if not records:
                print("   ⚠️ No usable text found — forcing OCR")

                images = convert_from_path(path, dpi=300)

                for i, img in enumerate(images):
                    img = img.convert("L")  # 🔑 grayscale

                    text = pytesseract.image_to_string(
                        img,
                        config="--oem 3 --psm 6"
                    )

                    if text.count(" ") < 20:
                        continue

                    records.append({
                        "source": path,
                        "page": i,
                        "text": text
                    })

        # ================= WRITE OUTPUT =================
        for r in records:
            with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
            total_blocks += 1

        print(f"   ✓ Extracted {len(records)} text blocks")

    print("\n✅ LOADING COMPLETE")
    print(f"🧱 Text blocks written: {total_blocks}")
    print(f"📁 Output file: {OUTPUT_FILE}")
    print("➡ Next: run `2_chunking_embedding_ingestion.py`")

####################################################################################################
# ENTRYPOINT
####################################################################################################

if __name__ == "__main__":
    run_loader()
