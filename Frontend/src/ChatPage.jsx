import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import "./ChatPage.css";

function ChatPage({ currentUser }) {
  // --- State Management ---
  const [prompt, setPrompt] = useState("");
  const [currThreadId, setCurrThreadId] = useState(Date.now().toString());
  const [allThreads, setAllThreads] = useState([]);
  const [newChat, setNewChat] = useState(true);
  const [prevChats, setPrevChats] = useState([]);
  const [loading, setLoading] = useState(false);

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Track last uploaded file for follow-up queries, persisting in session
  const [lastUploadedFilename, setLastUploadedFilename] = useState(() => {
    return sessionStorage.getItem("rag_last_filename") || null;
  });

  // Helper to update filename state and session storage
  const updateLastUploadedFilename = (filename) => {
    setLastUploadedFilename(filename);
    if (filename) {
      sessionStorage.setItem("rag_last_filename", filename);
    } else {
      sessionStorage.removeItem("rag_last_filename");
    }
  };

  // Refs
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // --- Sidebar Logic ---
  const isAdmin = (currentUser && currentUser.role === 'admin') || currentUser === 'admin';

  const startNewChat = () => {
    setPrevChats([]);
    setNewChat(true);
    setCurrThreadId(Date.now().toString());
    setPrompt("");
    setSelectedFiles([]);
  };

  const loadThread = async (threadId) => {
    setCurrThreadId(threadId);
    setNewChat(false);
    if (!currentUser || !currentUser._id) return;
    try {
      const res = await fetch(`/api/thread/${threadId}?userId=${currentUser._id}`);
      if (res.ok) {
        const msgs = await res.json();
        setPrevChats(msgs);
      }
    } catch (error) {
      console.error("Failed to load thread", error);
    }
  };

  // --- Chat Logic ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [prevChats, loading]);

  // Fetch threads on mount/user change
  useEffect(() => {
    if (currentUser && currentUser._id) {
      fetch(`/api/user/${currentUser._id}/init`)
    }
  }, [currentUser]);

  // --- Input Logic ---
  const handlePlusClick = () => {
    // Force clear the input value before clicking to ensure onChange always fires
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
    // We clear it in handlePlusClick now, but keeping it here doesn't hurt
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const uploadFileToPython = (file, query) => {
    return new Promise((resolve, reject) => {
      // NOTE: Using the IP provided in the user snippet. 
      const ws = new WebSocket("ws://192.168.10.1:8000");

      // Set a timeout to reject the promise if things hang
      const timeoutId = setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) {
          console.error("Python server timeout");
          ws.close();
          reject(new Error("Timeout waiting for Python server"));
        }
      }, 60000); // 60 seconds

      ws.onopen = async () => {
        console.log("Connected to Python WS server");
        const meta = {
          type: "file_meta",
          filename: file.name,
          size: file.size,
          query: query // Send the query/prompt
        };
        ws.send(JSON.stringify(meta));

        // Convert File to ArrayBuffer to ensure binary transmission
        const arrayBuffer = await file.arrayBuffer();
        ws.send(arrayBuffer);

        console.log("📤 PDF sent to Python:", file.name);
      };

      ws.onmessage = (event) => {
        console.log("Python server says:", event.data);
        clearTimeout(timeoutId); // Clear timeout on response

        try {
          const response = JSON.parse(event.data);
          if (response.status === "success") {
            ws.close();
            resolve(response.rag_response);
          } else {
            // Handle explicit failures from server if any
            console.warn("Python server returned status:", response.status);
            ws.close();
            resolve("File uploaded, but RAG processing returned status: " + response.status);
          }
        } catch (e) {
          // Fallback for legacy plain text 
          if (event.data === "File received successfully") {
            ws.close();
            resolve("File received (no RAG output)");
          } else {
            // Unknown text response, close and resolve to avoid hanging
            ws.close();
            resolve("Server response: " + event.data);
          }
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeoutId);
        console.error("WebSocket error:", error);
        // Do not reject immediately if it's just a closure error, but usually onerror is fatal
        reject(error);
      };
    });
  };

  const queryPython = (filename, query) => {
    return new Promise((resolve) => {
      const ws = new WebSocket("ws://192.168.10.1:8000");
      const timeoutId = setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) ws.close();
        resolve("Timeout waiting for Python RAG response");
      }, 30000);

      ws.onopen = () => {
        // Send format: { type: "query", quetion: "...", role: "...", filename: "..." }
        // User explicitly asked for "quetion" in the JSON format.
        const payload = {
          type: "query",
          question: query,
          role: currentUser?.role || "user",
          filename: filename
        };
        ws.send(JSON.stringify(payload));
      };

      ws.onmessage = (event) => {
        clearTimeout(timeoutId);
        try {
          const response = JSON.parse(event.data);
          ws.close();
          resolve(response.rag_response || "No response content");
        } catch (e) {
          ws.close();
          resolve("Error parsing Python response");
        }
      };

      ws.onerror = () => {
        clearTimeout(timeoutId);
        resolve("Error connecting to Python server");
      };
    });
  };

  const getReply = async () => {
    // REMOVED: if (loading) return; to allow sending multiple queries/files without waiting
    if (!prompt.trim() && selectedFiles.length === 0) return;

    const currentPrompt = prompt;
    const currentFiles = selectedFiles;

    if (newChat) {
      setAllThreads((prev) => [
        {
          threadId: currThreadId,
          title: currentPrompt || "New Chat",
        },
        ...prev,
      ]);
      setNewChat(false);
    }

    // Structured message object
    const newMessage = {
      role: "user",
      content: currentPrompt,
      attachments: currentFiles.map(f => ({ name: f.name }))
    };

    setPrevChats((prev) => [...prev, newMessage]);

    // Prepare content for calculation/simulation
    const attachmentsText = currentFiles.map(f => `[File sent to Python: ${f.name}]`).join(" ");
    const fullContentString = currentFiles.length > 0
      ? `${attachmentsText} \n ${currentPrompt}`
      : currentPrompt;

    setPrompt("");
    setSelectedFiles([]);
    setLoading(true);

    try {
      // 1. Send files to Python Server via WebSocket AND collect RAG responses
      let ragOutput = "";
      if (currentFiles.length > 0) {
        console.log("Uploading files to Python server...");
        // Upload sequentially to avoid connection issues or use Promise.all for parallel
        for (const file of currentFiles) {
          const result = await uploadFileToPython(file, currentPrompt);
          ragOutput += `\n\n[RAG Response for ${file.name}]: ${result}`;
          updateLastUploadedFilename(file.name);
        }
      } else if (lastUploadedFilename && currentPrompt) {
        // No new files, but we have text and a previous file context
        console.log(`Querying Python for stored file: ${lastUploadedFilename}`);

        // Notify user in UI that we are using context (optional, or rely on response)
        // ragOutput += `\n[Querying context: ${lastUploadedFilename}]...`; 

        const result = await queryPython(lastUploadedFilename, currentPrompt);
        ragOutput += `\n\n[RAG Response for ${lastUploadedFilename}]: ${result}`;
      }

      // 2. Send text message to Express Backend (without files)
      const formData = new FormData();
      formData.append("threadId", currThreadId);

      if (!fullContentString || fullContentString.trim().length === 0) {
        console.warn("Attempted to send empty message to backend");
        // Fallback to avoid 400 error if query was only for Python but we want to save it
        formData.append("message", "Processing file...");
      } else {
        formData.append("message", fullContentString);
      }

      console.log("Sending to Backend:", {
        threadId: currThreadId,
        message: fullContentString,
        userId: currentUser?._id,
        role: currentUser?.role
      });

      if (currentUser && currentUser._id) {
        formData.append("userId", currentUser._id);
      } else {
        console.error("User ID missing in currentUser object!", currentUser);
      }

      if (currentUser && currentUser.role) {
        formData.append("role", currentUser.role);
      } else {
        formData.append("role", "user");
      }

      // Intentionally NOT appending 'files' here so they don't go to Express

      const res = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed response from backend");
      }

      const data = await res.json();

      // Combine Express reply + RAG reply
      const finalReply = (data.reply || "") + (ragOutput ? `\n---${ragOutput}` : "");

      setPrevChats((prev) => [
        ...prev,
        {
          role: "assistant",
          content: finalReply
        }
      ]);
      setLoading(false);

    } catch (err) {
      console.error(err);
      setPrevChats((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error: Failed to process request (Check Python Server connection?)"
        }
      ]);
      setLoading(false);
    }
  };

  return (
    <div className="chat-page-container">

      {/* --- SIDEBAR SECTION --- */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>RagL<span style={{ fontWeight: '300' }}>an</span></h3>
        </div>

        <div className="new-chat-btn" onClick={startNewChat}>
          <span>+ New Chat</span>
        </div>

        <div className="threads-list">
          <p className="threads-title">Chat History</p>
          {allThreads.map((thread, index) => (
            <div
              key={index}
              className={`thread-item ${thread.threadId === currThreadId ? 'active' : ''}`}
              onClick={() => loadThread(thread.threadId)}
            >
              <i className="fa-regular fa-message"></i>
              <span>{thread.title.length > 20 ? thread.title.substring(0, 20) + "..." : thread.title}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          {isAdmin && (
            <div className="footer-item admin-item">
              <i className="fa-solid fa-shield-halved"></i>
              <span>Assign Role</span>
            </div>
          )}
          <div className="footer-item">
            <i className="fa-regular fa-user"></i>
            <span>Profile</span>
          </div>
        </div>
      </div>

      {/* --- MAIN CHAT AREA --- */}
      <div className="chat-main">

        {/* Navbar */}
        <div className="navbar">
          <span>RagLan <i className="fa-solid fa-chevron-down"></i></span>
          <div className="userIconDiv">
            <span className="userIcon"><i className="fa-solid fa-circle-user"></i></span>
          </div>
        </div>

        {/* Messages Area */}
        <div className="chat-messages-area">
          {newChat && (
            <div className="empty-state">
              <div className="greeting-container">
                <img src="lemon.png" className="greeting-lemon" alt="Logo" />
                <h1 className="greeting-text">Hello, {currentUser?.name || (typeof currentUser === 'string' ? currentUser : 'Guest')}</h1>
                <h2 className="greeting-sub">What shall we do?</h2>
              </div>
            </div>
          )}

          <div className="messages-list">
            {prevChats.map((chat, idx) => (
              <div
                className={chat.role === "user" ? "user-div" : "gpt-div"}
                key={idx}
              >
                {chat.role === "user" ? (
                  <div className="user-text-bubble">
                    {/* Render Attachments inside the bubble */}
                    {chat.attachments && chat.attachments.length > 0 && (
                      <div className="msg-attachments">
                        {chat.attachments.map((file, fIdx) => (
                          <div key={fIdx} className="msg-file-card">
                            <div className="file-icon-wrapper">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                              </svg>
                            </div>
                            <span className="msg-file-name">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* User Text */}
                    {chat.content && <p className="msg-text">{chat.content}</p>}
                  </div>
                ) : (
                  <div className="gpt-text-content">
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {chat.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="gpt-div loader-wrapper">
                <img src="lemon_rotate.png" className="lemon-loader" alt="Generating..." />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="chat-input-wrapper">
          <div className="input-box">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt"
              multiple
            />

            <div className="icon-btn plus-icon" onClick={handlePlusClick}>
              <img src="plus.png" className="action-icon" alt="Upload" />
            </div>

            {selectedFiles.map((file, index) => (
              <div className="file-chip" key={index}>
                {/* File Icon SVG */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#aaa' }}>
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                </svg>

                <span className="file-name">{file.name}</span>

                {/* Close/Remove SVG */}
                <div className="remove-file" onClick={(e) => { e.stopPropagation(); removeFile(index); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </div>
              </div>
            ))}

            <input
              className="text-input"
              placeholder={selectedFiles.length > 0 ? "Ask about this file..." : (lastUploadedFilename ? `Ask about ${lastUploadedFilename}...` : "What shall we do?")}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" ? getReply() : null}
            />

            <div className="icon-btn submit-icon" onClick={getReply}>
              <img src="send.png" className="action-icon" alt="Send" />
            </div>
          </div>
          <p className="disclaimer">
            RagLan can make mistakes. Check important info.
          </p>
        </div>

      </div>
    </div>
  );
}

export default ChatPage;
