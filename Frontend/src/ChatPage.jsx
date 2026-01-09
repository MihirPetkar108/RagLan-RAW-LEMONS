import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

const WS_URL = "ws://192.168.10.1:8000"; // change if needed

export default function ChatPage({ currentUser }) {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  /* ---------------- UI helpers ---------------- */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const openFilePicker = () => {
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const onFileChange = (e) => {
    if (e.target.files?.length) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ---------------- WebSocket helpers ---------------- */

  const uploadFile = (file) => {
    return new Promise((resolve) => {
      const ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";

      ws.onopen = async () => {
        ws.send(JSON.stringify({
          type: "file_meta",
          filename: file.name
        }));

        const buffer = await file.arrayBuffer();
        ws.send(buffer);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "status") {
            ws.close();
            resolve(msg.message);
          }
        } catch {
          ws.close();
          resolve("Upload completed");
        }
      };

      ws.onerror = () => {
        ws.close();
        resolve("Upload failed");
      };
    });
  };

  const sendQuery = (question) => {
    return new Promise((resolve) => {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "query",
          question: question,
          role: currentUser?.role || "engineer"
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "answer") {
            ws.close();
            resolve(msg.answer);
          }
        } catch {
          ws.close();
          resolve("Invalid server response");
        }
      };

      ws.onerror = () => {
        ws.close();
        resolve("Failed to connect to RAG server");
      };
    });
  };

  /* ---------------- Main send logic ---------------- */

  const handleSend = async () => {
    if (!prompt.trim() && selectedFiles.length === 0) return;

    const userMsg = {
      role: "user",
      content: prompt,
      attachments: selectedFiles.map(f => f.name)
    };

    setMessages(prev => [...prev, userMsg]);
    setPrompt("");
    setLoading(true);

    try {
      // 1️⃣ Upload files (if any)
      for (const file of selectedFiles) {
        await uploadFile(file);
      }
      setSelectedFiles([]);

      // 2️⃣ Ask query
      if (prompt.trim()) {
        const answer = await sendQuery(prompt);

        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: answer
          }
        ]);
      }
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "❌ Error communicating with RAG server"
        }
      ]);
    }

    setLoading(false);
  };

  /* ---------------- Render ---------------- */

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <h2>Offline RAG Chat</h2>

      {/* Messages */}
      <div style={{ minHeight: 400 }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: 16 }}>
            {msg.role === "user" ? (
              <div>
                <strong>You:</strong>
                {msg.attachments?.length > 0 && (
                  <div>
                    {msg.attachments.map((f, i) => (
                      <span key={i} style={{ marginRight: 8 }}>📄 {f}</span>
                    ))}
                  </div>
                )}
                <p>{msg.content}</p>
              </div>
            ) : (
              <div>
                <strong>RAG:</strong>
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {loading && <p>⏳ Processing…</p>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ marginTop: 20 }}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          multiple
          accept=".pdf,.txt,.doc,.docx"
          onChange={onFileChange}
        />

        <button onClick={openFilePicker}>+ File</button>

        {selectedFiles.map((f, i) => (
          <span key={i} style={{ marginLeft: 8 }}>
            {f.name} ❌
            <button onClick={() => removeFile(i)}>x</button>
          </span>
        ))}

        <div style={{ marginTop: 10 }}>
          <input
            style={{ width: "80%" }}
            value={prompt}
            placeholder="Ask about your documents..."
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
}

