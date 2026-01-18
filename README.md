# RagLan

**LAN-based Client–Server Retrieval-Augmented Generation (RAG) System**

RagLan is a **local network (LAN) client–server RAG architecture** designed for fast, secure, and offline-capable intelligent querying over private documents. The system separates **retrieval**, **embedding**, and **generation** responsibilities between a central server and multiple lightweight clients.

---

## 📌 Table of Contents

* [Overview](#overview)
* [Architecture](#architecture)
* [Key Features](#key-features)
* [System Components](#system-components)
* [Data Flow](#data-flow)
* [Tech Stack](#tech-stack)
* [Project Structure](#project-structure)
* [Setup & Installation](#setup--installation)
* [Running the System](#running-the-system)
* [Security Considerations](#security-considerations)
* [Local-RAG-with-Ollama](#Local-RAG-with-Ollama)
* [Contributors](#contributors)

---

## 🧠 Overview

RagLan enables **Retrieval-Augmented Generation (RAG)** within a **closed LAN environment**, ensuring:

* Data privacy (no external API calls)
* Low latency responses
* Scalability across multiple clients

Clients send user queries to a central RAG server, which retrieves relevant context from a vector database and generates responses using an LLM.

---

## Architecture

**High-Level Design:**

Client Nodes (UI / CLI / HMI)

```
User Query → Client → LAN → RAG Server → Response → Client
```

**Server Responsibilities:**

* Document ingestion & chunking
* Embedding generation
* Vector storage & similarity search
* LLM-based answer generation

**Client Responsibilities:**

* User interaction
* Query forwarding
* Response visualization

---

## Key Features

* Fully **offline / LAN-only** operation
* Modular RAG pipeline
* Multi-client support
* Plug-and-play embedding & LLM models
* Configurable chunking and retrieval strategy

---

## System Components

### 1. Client

* Web UI / Desktop App / CLI
* Sends query requests to server
* Displays generated answers

### 2. RAG Server

* REST / WebSocket API
* Retriever + Generator pipeline
* Manages vector database

### 4. LLM Engine

* Local LLM (CPU / GPU)
* Generates final response using retrieved context
* Provides Citations
* Also Performs OCR for image text Retreival

---

## Data Flow

1. Documents are ingested on the server
2. Documents are chunked and embedded
3. Embeddings are stored in the vector DB
4. Client sends a query
5. Server retrieves top-k relevant chunks
6. Retrieved context is passed to the LLM
7. Generated answer is returned to the client

---

## Tech Stack

**Backend (Server/Client):**

* Node JS
* Express JS
* FastAPI
* RAG Pipeline
* TCP Python Socket

**Client:**

* HTML, CSS, Javascript
* React
* JS websocket

**RAG Pipeline:**

* Langchain
* Ollama
* **LLM** - Mistral:7b
* **Embedding models** - nomic-embed-test & MiniLM-l6-v2

---

## 📁 Project Structure

```
RagLan/
│── serverCodes/
│   ├── ocr_utils.py
│   ├── rag_ingest.py
│   ├── rag_load.py
│   ├── rag_query.py
│   └── server.py
│
│── Backend/
│   ├── models/
│   ├── routes/
│   ├── uploads/
|   └── readme.md
|
│── Frontend/
|   │── public/
|   │── src/
|   │── index.html
|   └── readme.md
|
│── Local-RAG-with-Ollama
|   │── 1_loading_pdfs.py
|   │── 2_chunking_embeddings_ingestion.py
|   │── rag_cli.py
|   └── readme.md
│── README.md
└── requirement.txt
```

---

## Setup & Installation

### Prerequisites

* Python ≥ 3.9
* LAN connectivity
* GPU (optional but recommended)

### Install Dependencies

```
pip install -r requirements.txt
```

---

## Running the System

### Start Server

```
python server/main.py
```

### Start Client

```
npm start #starting the backend
```
In a different terminal
```
npm run dev #starting the frontend
```
---


## Security Considerations

* LAN-only access
* No external API calls
* Optional authentication layer
* Firewall-restricted ports

---


## Independent (Non-Integrated) RAG Setup

In addition to the LAN-based client–server architecture, we also maintained a **fully independent, non-integrated RAG setup**. This setup is intended for **experimentation, benchmarking, and rapid prototyping** without any client–server or networking dependencies.

### Purpose

* Isolated testing of RAG components
* Model and retriever benchmarking
* Debugging ingestion, chunking, and retrieval logic
* Comparing outputs before LAN integration

### Characteristics

* Runs as a standalone pipeline
* No client–server communication
* Single entry-point script or notebook
* Direct interaction with documents and models

### 📁 Folder Structure

```
RagLan/
│── Local-RAG-with-Ollama/
│   ├── 1_loading_pdfs.py
│   ├── 2_chunking_embedding_ingestion.py
│   └── rag_cli.py
```



### Relationship to LAN RAG

* Acts as a development and validation baseline
* Proven configurations are migrated to the LAN server
* Reduces risk during client–server integration

---

##  Contributors

* Bhavya Shah
* Mihir Petkar
* Harsh Manojokumar
* Yash Thakkar

---

