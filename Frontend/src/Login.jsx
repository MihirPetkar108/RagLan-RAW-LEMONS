import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLogin }) => { // Accept onLogin prop
  const [isLoginExpanded, setIsLoginExpanded] = useState(false);
  const [splashes, setSplashes] = useState([]);

  // State for form inputs
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');

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

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    // Simulate auth check here
    if (onLogin) {
      // Hardcoded Admin Check
      if (userId === 'admin' && password === 'admin123') {
        onLogin('admin'); // Log in as admin
      } else {
        onLogin(userId || 'user'); // Log in as regular user
      }
    }
  };

  return (
    <div
      className={`login-page-container ${isLoginExpanded ? 'split-view' : 'full-view'}`}
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
            <span className="big-letter">R</span>ag<span className="big-letter">L</span>an
          </h1>

          <div className={`initial-login-trigger ${isLoginExpanded ? 'hidden' : ''}`}>
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
          <p className="form-sub">Enter your UserId and Password to access your account</p>

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

            {/* Optional styling row for visual match */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', fontSize: '1rem', color: '#666' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" style={{ width: 'auto', transform: 'scale(1.3)' }} /> Remember me
              </label>
              <span style={{ cursor: 'pointer' }}>Forgot Password</span>
            </div>

            <button type="submit" className="login-submit-btn">
              Sign In
            </button>
          </form>
        </div>
      </div>

    </div>
  );
};

export default Login;
