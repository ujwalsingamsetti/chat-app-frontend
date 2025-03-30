import { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import Picker from 'emoji-picker-react';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const newSocket = io('https://chat-app-backend-mgik.onrender.com', {
        transports: ['websocket', 'polling'], // Ensure compatibility
        auth: { token }
      });      
      setSocket(newSocket);

      newSocket.on('connect', () => console.log('Socket connected'));
      newSocket.on('connect_error', (err) => {
        console.error('Socket connect error:', err);
        if (err.message === 'Authentication error: Invalid token') {
          localStorage.removeItem('token');
          window.location.href = '/';
        }
      });
      newSocket.on('onlineUsers', (users) => {
        setOnlineUsers(users);
      });

      newSocket.on('newMessage', (msg) => {
        if (!selectedUser || msg.recipientId === selectedUser?.id || msg.recipientId === null) {
          setMessages((prev) => [...prev, msg]);
          if (document.hidden && Notification.permission === 'granted') {
            new Notification(`New message from ${msg.username}`, {
              body: msg.message,
              icon: 'https://via.placeholder.com/32'
            });
          }
        }
      });

      newSocket.on('newReaction', (reactionData) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === reactionData.messageId
              ? { ...msg, reactions: [...(msg.reactions || []), reactionData] }
              : msg
          )
        );
      });

      newSocket.on('typing', (username) => {
        setTypingUser(username);
      });

      newSocket.on('stopTyping', () => {
        setTypingUser(null);
      });

      return () => {
        newSocket.off('newMessage');
        newSocket.off('newReaction');
        newSocket.off('onlineUsers');
        newSocket.off('typing');
        newSocket.off('stopTyping');
        newSocket.off('connect');
        newSocket.off('connect_error');
        newSocket.disconnect();
      };
    } else {
      console.error('No token found, redirecting to login');
      window.location.href = '/';
    }
  }, [selectedUser]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const url = selectedUser
          ? `${process.env.REACT_APP_API_URL || 'http://localhost:5500'}/messages?recipientId=${selectedUser.id}`
          : `${process.env.REACT_APP_API_URL || 'http://localhost:5500'}/messages`;
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setMessages(response.data);
      } catch (err) {
        console.error('Fetch messages error:', err);
        if (err.response && err.response.status === 403) {
          localStorage.removeItem('token');
          window.location.href = '/';
        }
      }
    };
    fetchMessages();

    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, [selectedUser]);

  const sendMessage = () => {
    if (message.trim() && socket) {
      socket.emit('sendMessage', { message, recipientId: selectedUser?.id });
      setMessage('');
      setShowEmojiPicker(false);
    }
  };

  const handleReaction = (messageId, reaction) => {
    if (socket) {
      socket.emit('react', { messageId, reaction });
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    if (socket) {
      socket.emit('typing', { recipientId: selectedUser?.id });
      clearTimeout(window.typingTimeout);
      window.typingTimeout = setTimeout(() => socket.emit('stopTyping', { recipientId: selectedUser?.id }), 1000);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    if (socket) {
      socket.disconnect();
    }
    window.location.href = '/';
  };

  const onEmojiClick = (emojiObject) => {
    setMessage((prev) => prev + emojiObject.emoji);
  };

  return (
    <div className={`flex h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Sidebar */}
      <div className={`w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg flex flex-col`}>
        <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <h3 className="text-lg font-semibold">Online Users</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div
            className={`flex items-center p-3 rounded-lg cursor-pointer ${!selectedUser ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-200') : ''}`}
            onClick={() => setSelectedUser(null)}
          >
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            <span className="text-sm font-medium">Public Chat</span>
          </div>
          {onlineUsers.map((user) => (
            <div
              key={user.id}
              className={`flex items-center p-3 rounded-lg cursor-pointer ${selectedUser?.id === user.id ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-200') : ''}`}
              onClick={() => setSelectedUser(user)}
            >
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              <span className="text-sm font-medium">{user.username}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className={`p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-md flex justify-between items-center`}>
          <h2 className="text-xl font-semibold">
            {selectedUser ? `Chat with ${selectedUser.username}` : 'Public Chat Room'}
          </h2>
          <div className="space-x-2">
            <button
              onClick={toggleDarkMode}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'}`}
            >
              {isDarkMode ? 'Light' : 'Dark'}
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className={`flex-1 overflow-y-auto p-4 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
          {messages.length > 0 ? (
            messages.map((msg, index) => (
              <div key={msg.id || index} className="mb-4 animate-slide-in">
                <div
                  className={`inline-block p-3 rounded-lg shadow-md ${isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'}`}
                >
                  <div className="flex items-center space-x-2">
                    <strong className="text-sm">{msg.username || 'Unknown'}</strong>
                    <span className="text-xs opacity-75">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-1">{msg.message || 'No content'}</p>
                  <div className="mt-2 flex space-x-2">
                    <button
                      onClick={() => handleReaction(msg.id, '👍')}
                      className="text-sm hover:bg-indigo-700 p-1 rounded"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => handleReaction(msg.id, '❤️')}
                      className="text-sm hover:bg-indigo-700 p-1 rounded"
                    >
                      ❤️
                    </button>
                  </div>
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="mt-1 text-xs opacity-75">
                      {msg.reactions.map((r, i) => (
                        <span key={i} className="mr-2">{r.reaction} {r.username}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 mt-10">No messages yet—say hi!</p>
          )}
          {typingUser && (
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} animate-fade-in`}>{typingUser} is typing...</p>
          )}
        </div>

        {/* Input Area */}
        <div className={`p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
          {showEmojiPicker && (
            <div className="absolute bottom-20 right-4">
              <Picker onEmojiClick={onEmojiClick} />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 rounded-lg hover:bg-gray-200"
            >
              😊
            </button>
            <input
              type="text"
              value={message}
              onChange={handleTyping}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              className={`flex-1 p-2 rounded-lg border ${isDarkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            />
            <button
              onClick={sendMessage}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;