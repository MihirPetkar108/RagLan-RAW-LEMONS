import React, { useState, useEffect } from 'react';
import Login from './Login';
import ChatPage from './ChatPage'; // Unified Component
import './App.css';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        // Check if user was previously authenticated
        return localStorage.getItem('isAuthenticated') === 'true';
    });
    const [currentUser, setCurrentUser] = useState(() => {
        // Restore user data from localStorage
        const savedUser = localStorage.getItem('currentUser');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    const handleLogin = (userId) => {
        setIsAuthenticated(true);
        setCurrentUser(userId);
        // Persist authentication state
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('currentUser', JSON.stringify(userId));
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setCurrentUser(null);
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('rag_last_filename');
    };

    return (
        <div className="App">
            {!isAuthenticated ? (
                <Login onLogin={handleLogin} />
            ) : (
                /* ChatPage handles its own layout and context logic internally now */
                <ChatPage currentUser={currentUser} onLogout={handleLogout} />
            )}
        </div>
    );
}

export default App;
