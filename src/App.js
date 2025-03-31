import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Chat from './components/Chat';
import Login from './components/Login';
import Register from './components/Register';
import axios from 'axios';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const validateToken = async () => {
      if (token) {
        try {
          // Validate the token by making a request to a protected endpoint
          await axios.get(`${process.env.REACT_APP_API_URL || 'https://chat-app-backend-mgik.onrender.com'}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('Token is valid');
        } catch (err) {
          console.error('Token validation failed:', err.response ? err.response.data : err.message);
          localStorage.removeItem('token');
          setToken(null);
          window.location.href = '/';
        }
      }
    };
    validateToken();
  }, [token]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/chat"
          element={token ? <Chat /> : <Navigate to="/" replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;