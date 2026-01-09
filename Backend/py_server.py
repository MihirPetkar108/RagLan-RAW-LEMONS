import asyncio
import websockets
import json
import os

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

def process_with_rag(file_path, query):
    # --- RAG PIPELINE PLACEHOLDER ---
    # Put your actual RAG code here (indexing, splitting, vector store query)
    print(f"Running RAG pipeline on {file_path} with query: '{query}'")
    import time
    time.sleep(1) # Simulate processing time
    
    # Example logic using the query
    return f"Processed {os.path.basename(file_path)}: Extracted insights for query '{query}' from RAG pipeline."

async def handler(ws):
    print("Client connected")
    current_filename = None
    current_query = None

    try:
        async for message in ws:
            # message will be str (metadata) or bytes (file content)
            if isinstance(message, str):
                try:
                    meta = json.loads(message)
                    if meta.get("type") == "file_meta":
                        current_filename = meta["filename"]
                        filesize = meta["size"]
                        current_query = meta.get("query", "") # Extract query
                        print(f"Expecting file: {current_filename} ({filesize} bytes) | Query: {current_query}")

                    elif meta.get("type") == "query":
                        # Handle text-only query on previously uploaded file
                        target_filename = meta.get("filename")
                        # Support both 'query' (old) and 'quetion' (user requested spec) and 'question' (correct spelling)
                        query_text = meta.get("quetion") or meta.get("question") or meta.get("query")
                        user_role = meta.get("role")
                        
                        print(f"Received query request for {target_filename}: '{query_text}' | Role: {user_role}")

                        file_path = os.path.join(UPLOAD_DIR, target_filename)
                        if os.path.exists(file_path):
                            rag_result = process_with_rag(file_path, query_text)
                            response_data = {
                                "status": "success",
                                "rag_response": rag_result
                            }
                            await ws.send(json.dumps(response_data))
                        else:
                            await ws.send(json.dumps({
                                "status": "error",
                                "rag_response": f"File {target_filename} not found on server."
                            }))
                        # No binary data expected for this type
                        
                    else:
                        print("Received unknown text message:", message)
                except json.JSONDecodeError:
                    print("Received non-JSON text message:", message)
            
            elif isinstance(message, bytes):
                if current_filename:
                    print(f"Receiving binary data for {current_filename}...")
                    file_path = os.path.join(UPLOAD_DIR, current_filename)
                    with open(file_path, "wb") as f:
                        f.write(message)
                    
                    print(f"✅ File saved: {current_filename}")
                    
                    # 1. Run the RAG Pipeline with the query
                    rag_result = process_with_rag(file_path, current_query)

                    # 2. Send back JSON response
                    response_data = {
                        "status": "success",
                        "rag_response": rag_result
                    }
                    await ws.send(json.dumps(response_data))
                    
                    current_filename = None # Reset for next file
                    current_query = None
                else:
                    print("⚠️ Received binary data without metadata first!")
    except websockets.exceptions.ConnectionClosedOK:
        print("Client disconnected normally")
    except Exception as e:
        print(f"Error: {e}")

async def main():
    print("Server starting on 0.0.0.0:8000...")
    async with websockets.serve(handler, "0.0.0.0", 8000):
        print("Server running and waiting for connections...")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
