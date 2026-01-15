import asyncio
import websockets
import json
import os

from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError

from rag_load import load_documents
from rag_ingest import ingest_documents
from rag_query import answer_query

UPLOAD_DIR = "/home/nomathematician/Aerothon26/Local-RAG-with-Ollama/pdfs/engineering"
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def handler(ws):
    print("🟢 Client connected")
    current_filename = None
    chat_history = []

    try:
        async for message in ws:

            # ================= TEXT =================
            if isinstance(message, str):
                data = json.loads(message)

                # ---------- FILE META ----------
                if data.get("type") == "file_meta":
                    current_filename = data.get("filename")
                    print(f"📄 Expecting file: {current_filename}")

                # ---------- QUERY ----------
                elif data.get("type") == "query":
                    question = data.get("question")
                    role = data.get("role", "engineer")

                    if not question:
                        await ws.send(json.dumps({
                            "type": "error",
                            "message": "Question missing"
                        }))
                        continue

                    print(f"❓ Query: {question}")
                    print("🤖 LLM is generating answer...", flush=True)

                    answer = answer_query(
                    question=question,
                    role=role,
                    history=chat_history
                    )

                    print("✅ Answer generated", flush=True)
                    print("📝 Answer:\n" + "-" * 40)
                    print(answer)
                    print("-" * 40, flush=True)


                    chat_history.append({
                        "question": question,
                        "answer": answer
                    })

                    await ws.send(json.dumps({
                        "type": "answer",
                        "answer": answer
                    }))

            # ================= BINARY =================
            elif isinstance(message, bytes) and current_filename:
                file_path = os.path.join(UPLOAD_DIR, current_filename)

                with open(file_path, "wb") as f:
                    f.write(message)

                print("📚 Running ingestion pipeline...")

                load_documents()
                ingest_documents()

                await ws.send(json.dumps({
                    "type": "status",
                    "message": "Document ingested successfully"
                }))

                current_filename = None

    except ConnectionClosedOK:
        print("🔵 Client disconnected")

    except ConnectionClosedError:
        print("🔴 Abnormal disconnect")

    except Exception as e:
        print(f"❌ Server error: {e}")

async def main():
    print("🚀 RAG Server running on ws://0.0.0.0:8000")
    async with websockets.serve(  handler,
    "0.0.0.0",
    8000,
    max_size=500 * 1024 * 1024,  # 500 MB
    read_limit=2**20,             # 1 MB read buffer
    write_limit=2**20             # 1 MB write buffer
    ):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
