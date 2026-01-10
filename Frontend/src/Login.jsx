import React, { useState } from "react";
import "./Login.css";

const Login = ({ onLogin }) => {
    // Accept onLogin prop
    const [isLoginExpanded, setIsLoginExpanded] = useState(false);
    const [splashes, setSplashes] = useState([]);

    // State for form inputs
    const [userId, setUserId] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSplash = (e) => {
        // Create a new splash object with unique ID and coordinates
        const newSplash = {
            id: Date.now(),
            x: e.clientX,
            y: e.clientY,
        };

        setSplashes((prev) => [...prev, newSplash]);

        // Remove the splash from state after animation finishes (600ms)
        setTimeout(() => {
            setSplashes((prev) => prev.filter((s) => s.id !== newSplash.id));
        }, 600);
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        if (!onLogin) return;

        // Clear any previous error message
        setErrorMessage("");

        // Start submitting state for animation
        setIsSubmitting(true);

        try {
            // Use relative path '/api' which is proxied to localhost:8080 by Vite
            const loginRes = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: userId, password }),
            });

            if (loginRes.ok) {
                const user = await loginRes.json();
                onLogin(user);
            } else {
                const errorData = await loginRes.json().catch(() => null);
                // Show backend error message inline below password field
                setErrorMessage(
                    errorData?.error ||
                        "Login failed. Please check your credentials."
                );
            }
        } catch (err) {
            console.error(err);
            setErrorMessage("Failed to connect to backend");
        } finally {
            // Stop submitting state once request finishes (success or error)
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className={`login-page-container ${
                isLoginExpanded ? "split-view" : "full-view"
            }`}
            onClick={handleSplash} // Global click listener active
        >
            {/* Render active splashes */}
            {splashes.map((splash) => (
                <div
                    key={splash.id}
                    className="splash-effect"
                    style={{ top: splash.y, left: splash.x }}
                />
            ))}

            {/* Left Panel: Branding & Background */}
            <div className="brand-panel">
                <div className="brand-content">
                    {/* Transparent Lemon Image Background */}
                    <img
                        src="lemon.png"
                        alt="Lemon Background"
                        className="lemon-bg"
                    />

                    <h1 className="brand-title">
                        <span className="big-letter">R</span>ag
                        <span className="big-letter">L</span>an
                    </h1>

                    <div
                        className={`initial-login-trigger ${
                            isLoginExpanded ? "hidden" : ""
                        }`}
                    >
                        <button
                            className="trigger-btn"
                            onClick={(e) => {
                                e.stopPropagation(); // specific button logic shouldn't trigger splash purely optionally, but usually fine
                                setIsLoginExpanded(true);
                                handleSplash(e); // Manually trigger splash for button click visual feedback
                            }}
                        >
                            Login
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Login Form */}
            <div className="form-panel">
                <div className="form-container">
                    <h2 className="form-header">Welcome Back</h2>
                    <p className="form-sub">
                        Enter your UserId and Password to access your account
                    </p>

                    <form onSubmit={handleLoginSubmit}>
                        <div className="input-group">
                            <label>User ID</label>
                            <input
                                type="text"
                                placeholder="Enter your user ID"
                                required
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                            />
                        </div>

                        <div className="input-group">
                            <label>Password</label>
                            <input
                                type="password"
                                placeholder="Enter your password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {errorMessage && (
                            <div className="login-error-message">
                                {errorMessage}
                            </div>
                        )}

                        <button
                            type="submit"
                            className={`login-submit-btn ${
                                isSubmitting ? "login-submit-btn-loading" : ""
                            }`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="login-spinner" />
                                    <span className="login-submit-text">
                                        Signing in...
                                    </span>
                                </>
                            ) : (
                                <span className="login-submit-text">
                                    Sign In
                                </span>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
