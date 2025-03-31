import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors
  
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL || 'https://chat-app-backend-mgik.onrender.com'}/login`, {
        username,
        password,
      });
  
      console.log("Login response:", response.data);
  
      if (response.data.token) {
        localStorage.setItem("token", response.data.token); // Save token
        navigate('/chat'); // Redirect to dashboard or home
      } else {
        setError("Invalid response from server. Please try again.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid username or password");
    }
  };
  

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-gray-700 mb-2">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your username"
              autoComplete="username"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="block text-gray-700 mb-2">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your password"
              autoComplete="password"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-500 text-white p-2 rounded-lg hover:bg-indigo-600"
          >
            Login
          </button>
        </form>
        <p className="mt-4 text-center">
          Don't have an account?{' '}
          <a href="/register" className="text-indigo-500 hover:underline">
            Register
          </a>
        </p>
      </div>
    </div>
  );
}

export default Login;