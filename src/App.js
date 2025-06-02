// client/src/App.js
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Chat from './components/Chat';
import Login from './components/Login';
import Register from './components/Register';
import axios from 'axios';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [hasValidated, setHasValidated] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  useEffect(() => {
    const validateToken = async () => {
      if (hasValidated) return;
      setHasValidated(true);
      console.log('Validating token...');
      console.log('Current token:', token);
      if (!token) {
        console.log('No token found, user is not authenticated');
        setIsAuthenticated(false);
        return;
      }
      try {
        await axios.get(`${process.env.REACT_APP_API_URL || 'https://chat-app-backend-mgik.onrender.com'}/messages`, {
          withCredentials: true,
        });
        console.log('Token validation successful');
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Token validation failed:', err.response ? err.response.data : err.message);
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        setToken(null);
      }
    };
    validateToken();
  }, [hasValidated, token]); // Add token as a dependency

  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login setIsAuthenticated={setIsAuthenticated} setToken={setToken} />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/chat"
          element={isAuthenticated ? <Chat token={token} /> : <Navigate to="/" replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;