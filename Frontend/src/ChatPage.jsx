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

  // Refs
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // --- Sidebar Logic ---
  const isAdmin = currentUser === 'admin';

  const startNewChat = () => {
    setPrevChats([]);
    setNewChat(true);
    setCurrThreadId(Date.now().toString());
    setPrompt("");
    setSelectedFiles([]);
  };

  const loadThread = (threadId) => {
    setCurrThreadId(threadId);
    setNewChat(false);
  };

  // --- Chat Logic ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [prevChats, loading]);

  // --- Input Logic ---
  const handlePlusClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const getReply = async () => {
    if (!prompt.trim() && selectedFiles.length === 0) return;

    if (newChat) {
      setAllThreads((prev) => [
        {
          threadId: currThreadId,
          title: prompt || "New Chat",
        },
        ...prev,
      ]);
      setNewChat(false);
    }

    // Structured message object
    const newMessage = {
      role: "user",
      content: prompt,
      attachments: selectedFiles.map(f => ({ name: f.name }))
    };

    setPrevChats((prev) => [...prev, newMessage]);

    // Prepare content for calculation/simulation
    const attachmentsText = selectedFiles.map(f => `[File: ${f.name}]`).join(" ");
    const fullContentString = selectedFiles.length > 0
      ? `${attachmentsText} \n ${prompt}`
      : prompt;

    setPrompt("");
    setSelectedFiles([]);
    setLoading(true);

    try {
      // Simulation
      setTimeout(() => {
        setPrevChats((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "This is a simulated response based on your input: " + fullContentString
          }
        ]);
        setLoading(false);
      }, 1000);

    } catch (err) {
      console.error(err);
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
                <h1 className="greeting-text">Hello, {currentUser || 'Guest'}</h1>
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
              placeholder={selectedFiles.length > 0 ? "" : "What shall we do?"}
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
