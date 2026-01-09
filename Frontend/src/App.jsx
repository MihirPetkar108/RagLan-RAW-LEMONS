import React, { useState } from 'react';
import Login from './Login';
import ChatPage from './ChatPage'; // Unified Component
import './App.css';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    const handleLogin = (userId) => {
        setIsAuthenticated(true);
        setCurrentUser(userId);
    };

    return (
        <div className="App">
            {!isAuthenticated ? (
                <Login onLogin={handleLogin} />
            ) : (
                /* ChatPage handles its own layout and context logic internally now */
                <ChatPage currentUser={currentUser} />
            )}
        </div>
    );
}

export default App;
