# Local RAG with Ollama - PDF/DOCX/TXT Document Q&A

A Retrieval-Augmented Generation (RAG) chatbot that runs locally using Ollama, FAISS vector database, and Streamlit. Query your PDF, DOCX, and TXT documents with AI-powered responses.

## Features

- ✅ Process multiple document types (PDF, DOCX, TXT)
- ✅ Local LLM inference with Ollama (Mistral)
- ✅ FAISS vector database for fast retrieval
- ✅ Streamlit web interface
- ✅ Text cleaning to filter gibberish from PDFs
- ✅ Follow-up question support
- ✅ Citation tracking

## Prerequisites

- **Python 3.10-3.12**
- **Ollama** (for local LLM inference)

## Installation

### 1. Install Python

Download from [python.org](https://python.org) and install Python 3.10-3.12

### 2. Install Ollama

Download from [ollama.com](https://ollama.com) and install

### 3. Pull Required Models

```bash
ollama pull mistral
ollama pull all-minilm:latest
```

### 4. Clone/Download this repository

```bash
git clone <repository-url>
cd Local-RAG-with-Ollama
```

### 5. Create Virtual Environment (Recommended)

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate
```

### 6. Install Dependencies

```bash
pip install -r requirements.txt
```

### 7. Configure Environment Variables

- Copy `.env.example` to `.env`
- Default settings work for Ollama + Mistral

## Usage

### 1. Add Your Documents

Place your PDF, DOCX, or TXT files in the `pdfs/` folder

### 2. Load and Process Documents

```bash
python 1_loading_pdfs.py
set NUM_CORES=10
python 2_chunking_embedding_ingestion.py
```

### 3. Start the Chatbot

```bash
python -m streamlit run 3_chatbot.py
```

The chatbot will open at `http://localhost:8501`

## Configuration

### Performance Settings (3_chatbot.py)

- `num_thread=10` - CPU cores to use (adjust based on your system)
- `num_ctx=1536` - Context window size (increase for longer documents)
- `num_predict=400` - Max response length
- `num_batch=512` - Batch size for processing

### Chunking Settings (2_chunking_embedding_ingestion.py)

- `chunk_size=800` - Characters per chunk
- `chunk_overlap=100` - Overlap between chunks

## Hardware Recommendations

**CPU Only:**

- Response time: 60-120 seconds
- 8+ cores recommended

**With NVIDIA GPU:**

- RTX 3060 (12GB): ~8-12 seconds
- RTX 4060 (8GB): ~6-10 seconds
- RTX 1660 (6GB): ~15-25 seconds

Remove `num_gpu=0` from code to enable GPU acceleration.

## System Requirements

- **Minimum:** 8GB RAM, 4-core CPU, 10GB disk space
- **Recommended:** 16GB RAM, 8+ core CPU, 20GB disk space
- **Optimal:** 16GB+ RAM, NVIDIA GPU (6GB+ VRAM), SSD

## Download Size

- Ollama: ~500MB
- Mistral model: ~4GB
- all-minilm model: ~120MB
- Python packages: ~500MB
- **Total:** ~5-6GB

## Troubleshooting

**"Input length exceeds context":**

- Document too large - already handled with batch processing

**Gibberish in responses:**

- PDF has image-heavy pages - text cleaning filters most of this

**Slow responses:**

- Reduce `num_thread` if CPU is overloaded
- Consider GPU acceleration
- Use smaller model (llama3.2:3b)

**Out of memory:**

- Reduce `chunk_size` to 600
- Reduce `num_ctx` to 1024
- Close other applications

## Features

### In the Chatbot UI:

- **🔄 Reload Database** - Refresh after adding new documents
- **🗑️ Clear Chat History** - Start fresh conversation
- **Follow-up questions** - Ask related questions naturally
- **Citations** - See which pages were used for answers

## Tech Stack

- **LLM:** Mistral (via Ollama)
- **Embeddings:** all-minilm
- **Vector DB:** FAISS
- **Framework:** LangChain
- **UI:** Streamlit
- **Document Loading:** PyPDF, python-docx

## License

[Your License Here]

## Credits

Based on local RAG architecture with Ollama integration.
