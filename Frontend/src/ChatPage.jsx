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

    // Normalize messages coming from backend so any
    // "[File sent to Python: filename]" markers in content
    // are turned into proper attachments for UI display.
    const normalizeMessages = (rawMessages = []) => {
        return rawMessages.map((msg) => {
            if (!msg || typeof msg.content !== "string") return msg;

            const attachments = Array.isArray(msg.attachments)
                ? [...msg.attachments]
                : [];

            const fileRegex = /\[File sent to Python:([^\]]+)\]/g;
            let match;
            while ((match = fileRegex.exec(msg.content)) !== null) {
                const name = match[1].trim();
                if (name) attachments.push(name);
            }

            const cleanedContent = msg.content.replace(fileRegex, "").trim();

            return {
                ...msg,
                content: cleanedContent,
                attachments,
            };
        });
    };

    // --- Sidebar Logic ---
    const isAdmin =
        (currentUser && currentUser.role === "admin") ||
        currentUser === "admin";

    const startNewChat = () => {
        setPrevChats([]);
        setNewChat(true);
        setCurrThreadId(Date.now().toString());
        setPrompt("");
        setSelectedFiles([]);
        setLoading(false);
    };

    const loadThread = async (threadId) => {
        setCurrThreadId(threadId);
        setNewChat(false);
        setLoading(false);
        if (!currentUser || !currentUser._id) return;
        try {
            const res = await fetch(
                `/api/thread/${threadId}?userId=${currentUser._id}`
            );
            if (res.ok) {
                const msgs = await res.json();
                setPrevChats(normalizeMessages(msgs));
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
        const fetchInitialData = async () => {
            if (!currentUser || !currentUser._id) return;

            try {
                const res = await fetch(`/api/user/${currentUser._id}/init`);
                if (!res.ok) {
                    console.error("Failed to fetch user init data");
                    return;
                }

                const data = await res.json();

                // data.threads: array of { threadId, title, updatedAt }
                if (Array.isArray(data.threads)) {
                    setAllThreads(
                        data.threads.map((t) => ({
                            threadId: t.threadId,
                            title: t.title || "New Chat",
                        }))
                    );
                }

                // data.lastThread: { threadId, messages }
                if (data.lastThread && data.lastThread.threadId) {
                    setCurrThreadId(data.lastThread.threadId);
                    setPrevChats(
                        normalizeMessages(data.lastThread.messages || [])
                    );
                    setNewChat(false);
                } else {
                    // No existing threads; show empty state as a new chat
                    setNewChat(true);
                    setPrevChats([]);
                    setCurrThreadId(Date.now().toString());
                }
            } catch (error) {
                console.error("Error fetching initial threads:", error);
            }
        };

        fetchInitialData();
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
            const newFiles = Array.from(e.target.files);
            console.log("Files selected:", newFiles);
            setSelectedFiles((prev) => {
                const updated = [...prev, ...newFiles];
                console.log("Updated selectedFiles:", updated);
                return updated;
            });
        }
        // We clear it in handlePlusClick now, but keeping it here doesn't hurt
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (indexToRemove) => {
        setSelectedFiles((prev) =>
            prev.filter((_, index) => index !== indexToRemove)
        );
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
            }, 300000); // 5 minutes - RAG model needs time to process

            ws.onopen = async () => {
                console.log("Connected to Python WS server");
                const meta = {
                    type: "file_meta",
                    filename: file.name,
                    size: file.size,
                    query: query, // Send the query/prompt
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
                    // Handle "type": "status" format from working code
                    if (response.type === "status") {
                        ws.close();
                        resolve(response.message || "Upload completed");
                    }
                    // Fallback: handle old "status": "success" format
                    else if (response.status === "success") {
                        ws.close();
                        resolve(
                            response.rag_response ||
                                response.message ||
                                "Upload completed"
                        );
                    } else {
                        ws.close();
                        resolve(response.message || "Upload completed");
                    }
                } catch (e) {
                    // Fallback for plain text responses
                    ws.close();
                    resolve(event.data || "Upload completed");
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
            }, 180000); // 3 minutes - RAG model needs time to process

            ws.onopen = () => {
                // Send format: { type: "query", quetion: "...", role: "...", filename: "..." }
                // User explicitly asked for "quetion" in the JSON format.
                const payload = {
                    type: "query",
                    question: query,
                    role: currentUser?.role || "user",
                    filename: filename,
                };
                ws.send(JSON.stringify(payload));
            };

            ws.onmessage = (event) => {
                clearTimeout(timeoutId);
                try {
                    const response = JSON.parse(event.data);
                    // Handle "type": "answer" format from working code
                    if (response.type === "answer") {
                        ws.close();
                        resolve(response.answer || "No response content");
                    }
                    // Fallback: handle old rag_response format
                    else if (response.rag_response) {
                        ws.close();
                        resolve(response.rag_response);
                    } else {
                        ws.close();
                        resolve(
                            response.message ||
                                response.answer ||
                                "No response content"
                        );
                    }
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
        if (!prompt.trim() && selectedFiles.length === 0) return;

        const currentPrompt = prompt;
        const currentFiles = [...selectedFiles];

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

        // 1️⃣ Immediately add user message to chat (with attachments)
        const userMsg = {
            role: "user",
            content: currentPrompt,
            attachments: currentFiles.map((f) => f.name),
        };

        setPrevChats((prev) => [...prev, userMsg]);
        setPrompt("");
        setLoading(true);

        try {
            // 2️⃣ Upload files to Python server
            let ragOutput = "";
            if (currentFiles.length > 0) {
                console.log("Uploading files to Python server...");
                for (const file of currentFiles) {
                    const result = await uploadFileToPython(
                        file,
                        currentPrompt
                    );
                    ragOutput += result; // Store clean response without prefix
                    updateLastUploadedFilename(file.name);
                }
            } else if (lastUploadedFilename && currentPrompt) {
                // Query existing file context
                console.log(
                    `Querying Python for stored file: ${lastUploadedFilename}`
                );
                const result = await queryPython(
                    lastUploadedFilename,
                    currentPrompt
                );
                ragOutput = result; // Store clean response
            }

            setSelectedFiles([]); // Clear after upload

            // 3️⃣ Send to Express Backend for persistence
            const attachmentsText = currentFiles
                .map((f) => `[File sent to Python: ${f.name}]`)
                .join(" ");
            const fullContentString =
                currentFiles.length > 0
                    ? `${attachmentsText} \n ${currentPrompt}`
                    : currentPrompt;

            console.log("📊 RAG Output to send to backend:", ragOutput);

            const formData = new FormData();
            formData.append("threadId", currThreadId);
            formData.append(
                "message",
                fullContentString || "Processing file..."
            );

            // Always send ragResponse (backend will handle empty case)
            formData.append("ragResponse", ragOutput.trim() || "");

            if (currentUser && currentUser._id) {
                formData.append("userId", currentUser._id);
            }
            if (currentUser && currentUser.role) {
                formData.append("role", currentUser.role);
            } else {
                formData.append("role", "user");
            }

            const res = await fetch("/api/chat", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                throw new Error("Failed response from backend");
            }

            const data = await res.json();

            // 4️⃣ Add assistant response
            const finalReply =
                ragOutput || data.reply || "No response received";

            setPrevChats((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: finalReply,
                },
            ]);
        } catch (err) {
            console.error(err);
            setPrevChats((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "❌ Error communicating with RAG server",
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-page-container">
            {/* --- SIDEBAR SECTION --- */}
            <div className="sidebar">
                <div className="sidebar-header">
                    <h3
                        style={{ cursor: "pointer" }}
                        onClick={() => window.location.reload()}
                        title="Refresh"
                    >
                        RagL<span style={{ fontWeight: "300" }}>an</span>
                    </h3>
                </div>

                <div className="new-chat-btn" onClick={startNewChat}>
                    <span>+ New Chat</span>
                </div>

                <div className="threads-list">
                    <p className="threads-title">Chat History</p>
                    {allThreads.map((thread, index) => (
                        <div
                            key={index}
                            className={`thread-item ${
                                thread.threadId === currThreadId ? "active" : ""
                            }`}
                            onClick={() => loadThread(thread.threadId)}
                        >
                            <i className="fa-regular fa-message"></i>
                            <span>
                                {thread.title.length > 20
                                    ? thread.title.substring(0, 20) + "..."
                                    : thread.title}
                            </span>
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
                        <span>
                            {currentUser?.name ||
                                (typeof currentUser === "string"
                                    ? currentUser
                                    : "Guest")}
                        </span>
                    </div>
                </div>
            </div>

            {/* --- MAIN CHAT AREA --- */}
            <div className="chat-main">
                {/* Navbar */}
                <div className="navbar">
                    <span className="role-display">
                        {(currentUser && currentUser.role
                            ? currentUser.role
                            : "User"
                        ).toUpperCase()}
                        <i className="fa-solid fa-chevron-down"></i>
                    </span>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                        }}
                    >
                        <button
                            className="logoutBtn"
                            onClick={() => {
                                localStorage.clear();
                                sessionStorage.clear();
                                window.location.href = "/";
                            }}
                        >
                            Logout
                        </button>

                        <span className="userIcon">
                            <i className="fa-solid fa-circle-user"></i>
                        </span>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="chat-messages-area">
                    {newChat && (
                        <div className="empty-state">
                            <div className="greeting-container">
                                <img
                                    src="lemon.png"
                                    className="greeting-lemon"
                                    alt="Logo"
                                />
                                <h1 className="greeting-text">
                                    Hello,{" "}
                                    {currentUser?.name ||
                                        (typeof currentUser === "string"
                                            ? currentUser
                                            : "Guest")}
                                </h1>
                                <h2 className="greeting-sub">
                                    What shall we do?
                                </h2>
                            </div>
                        </div>
                    )}

                    <div className="messages-list">
                        {prevChats.map((chat, idx) => (
                            <div
                                className={
                                    chat.role === "assistant"
                                        ? "gpt-div"
                                        : "user-div"
                                }
                                key={idx}
                            >
                                {chat.role === "assistant" ? (
                                    <div className="gpt-text-content">
                                        <ReactMarkdown
                                            rehypePlugins={[rehypeHighlight]}
                                        >
                                            {chat.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="user-text-bubble">
                                        {/* Render Attachments inside the bubble */}
                                        {chat.attachments &&
                                            chat.attachments.length > 0 && (
                                                <div className="msg-attachments">
                                                    {chat.attachments.map(
                                                        (file, fIdx) => {
                                                            const fileName =
                                                                typeof file ===
                                                                "string"
                                                                    ? file
                                                                    : file?.name;
                                                            if (!fileName)
                                                                return null;
                                                            return (
                                                                <div
                                                                    className="msg-file-card"
                                                                    key={fIdx}
                                                                >
                                                                    <div className="file-icon-wrapper">
                                                                        <svg
                                                                            width="20"
                                                                            height="20"
                                                                            viewBox="0 0 24 24"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            strokeWidth="2"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                        >
                                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                                            <polyline points="14 2 14 8 20 8" />
                                                                            <line
                                                                                x1="16"
                                                                                y1="13"
                                                                                x2="8"
                                                                                y2="13"
                                                                            />
                                                                            <line
                                                                                x1="16"
                                                                                y1="17"
                                                                                x2="8"
                                                                                y2="17"
                                                                            />
                                                                            <polyline points="10 9 9 9 8 9" />
                                                                        </svg>
                                                                    </div>
                                                                    <span className="msg-file-name">
                                                                        {
                                                                            fileName
                                                                        }
                                                                    </span>
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            )}
                                        {/* User Text */}
                                        {chat.content && (
                                            <p className="msg-text">
                                                {chat.content}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div className="gpt-div loader-wrapper">
                                <img
                                    src="lemon_rotate.png"
                                    className="lemon-loader"
                                    alt="Generating..."
                                />
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="chat-input-wrapper">
                    {/* Debug: Show selectedFiles count */}
                    {console.log(
                        "Rendering with selectedFiles:",
                        selectedFiles
                    )}

                    {/* File Cards Container - Shows above input */}
                    {selectedFiles.length > 0 && (
                        <div className="uploaded-files-container">
                            {selectedFiles.map((file, index) => (
                                <div className="uploaded-file-card" key={index}>
                                    <div className="uploaded-file-content">
                                        <div className="uploaded-file-icon">
                                            <span className="pdf-badge">
                                                PDF
                                            </span>
                                        </div>
                                        <span
                                            className="uploaded-file-name"
                                            title={file.name}
                                        >
                                            {file.name}
                                        </span>
                                    </div>
                                    <button
                                        className="remove-uploaded-file"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeFile(index);
                                        }}
                                        aria-label="Remove file"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="input-box">
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx,.txt"
                            multiple
                        />

                        <div
                            className="icon-btn plus-icon"
                            onClick={handlePlusClick}
                        >
                            <img
                                src="plus.png"
                                className="action-icon"
                                alt="Upload"
                            />
                        </div>

                        <input
                            className="text-input"
                            placeholder={
                                selectedFiles.length > 0
                                    ? "Ask about this file..."
                                    : lastUploadedFilename
                                    ? `Ask about ${lastUploadedFilename}...`
                                    : "What shall we do?"
                            }
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" ? getReply() : null
                            }
                        />

                        <div
                            className="icon-btn submit-icon"
                            onClick={getReply}
                        >
                            <img
                                src="send.png"
                                className="action-icon"
                                alt="Send"
                            />
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
