import { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Users, Send, LogOut, Trash2, MessageCircle, Globe, Lock, Sun, Moon } from 'lucide-react'; // 'Users' and 'Trash2' are used now
import Picker from 'emoji-picker-react';

function Chat({ token }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeTab, setActiveTab] = useState('public');
  const isProcessingRef = useRef(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUser, setTypingUser] = useState(null);

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL || 'https://chat-app-backend-mgik.onrender.com'}/messages`, {
          withCredentials: true,
        });
        const publicMsgs = response.data.filter(msg => !msg.recipient);
        const privateMsgs = response.data.filter(msg => msg.recipient);
        setMessages(publicMsgs);
        setPrivateMessages(privateMsgs);
      } catch (err) {
        console.error('Error fetching messages:', err);
        if (err.response && err.response.status === 403) {
          localStorage.removeItem('token');
          window.location.href = '/';
        }
      }
    };
    fetchMessages();
  }, []);

  useEffect(() => {
    if (!token) return;

    const newSocket = io(process.env.REACT_APP_API_URL || 'https://chat-app-backend-mgik.onrender.com', {
      withCredentials: true,
      auth: { token },
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected');
      newSocket.emit('join-room', 'public');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connect error:', err);
      if (err.message === 'Authentication error: Invalid token') {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    });

    const handleMessage = (msg) => {
      if (msg.recipient) {
        setPrivateMessages((prev) => {
          if (prev.some(m => m._id === msg._id)) return prev;
          if (msg.id && prev.some(m => m._id === msg.id)) {
            return prev.map(m => m._id === msg.id ? { ...m, _id: msg._id } : m);
          }
          return [...prev, msg];
        });
      } else {
        setMessages((prev) => {
          if (prev.some(m => m._id === msg._id)) return prev;
          if (msg.id && prev.some(m => m._id === msg.id)) {
            return prev.map(m => m._id === msg.id ? { ...m, _id: msg._id } : m);
          }
          return [...prev, msg];
        });
      }
      if (document.hidden && Notification.permission === 'granted') {
        new Notification(`New message from ${msg.sender?.username || 'Unknown'}`, {
          body: msg.content,
          icon: 'https://via.placeholder.com/32'
        });
      }
      scrollToBottom();
    };

    const handleChatCleared = () => {
      setMessages([]);
    };

    const handleOnlineUsers = (users) => {
      setOnlineUsers(users);
    };

    const handleTyping = (username) => {
      setTypingUser(username);
    };

    const handleStopTyping = () => {
      setTypingUser(null);
    };

    newSocket.on('message', handleMessage);
    newSocket.on('online-users', handleOnlineUsers);
    newSocket.on('chat-cleared', handleChatCleared);
    newSocket.on('typing', handleTyping);
    newSocket.on('stopTyping', handleStopTyping);

    return () => {
      newSocket.off('message', handleMessage);
      newSocket.off('chat-cleared', handleChatCleared);
      newSocket.off('online-users', handleOnlineUsers);
      newSocket.off('typing', handleTyping);
      newSocket.off('stopTyping', handleStopTyping);
      newSocket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, privateMessages, activeTab]);

  useEffect(() => {
    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();

    if (isProcessingRef.current || !message.trim() || !socket || !socket.connected) {
      return;
    }

    isProcessingRef.current = true;
    setIsSending(true);
    setShowEmojiPicker(false);

    const tempMessageId = uuidv4();
    const currentTime = new Date().toISOString();

    let currentUserId = '';
    let currentUsername = 'You';

    try {
      if (token) {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        currentUserId = decodedToken.userId;
        currentUsername = decodedToken.username || 'You';
      }
    } catch (err) {
      console.warn("Could not decode token for optimistic sender name. Using 'You'.", err);
    }

    const messageDataToSend = selectedUser
      ? { id: tempMessageId, content: message, recipient: selectedUser.userId }
      : { id: tempMessageId, content: message, room: 'public' };

    const newMessageForDisplay = {
      _id: tempMessageId,
      sender: {
        _id: currentUserId,
        username: currentUsername,
      },
      content: message,
      createdAt: currentTime,
      recipient: selectedUser ? { _id: selectedUser.userId, username: selectedUser.username } : null,
      room: selectedUser ? null : 'public',
    };

    if (selectedUser) {
      setPrivateMessages((prev) => [...prev, newMessageForDisplay]);
    } else {
      setMessages((prev) => [...prev, newMessageForDisplay]);
    }

    socket.emit('message', messageDataToSend);
    setMessage('');

    setTimeout(() => {
      isProcessingRef.current = false;
      setIsSending(false);
    }, 1000);
  }, [message, socket, selectedUser, token]);

  const handleTyping = (e) => {
    setMessage(e.target.value);
    if (socket && socket.connected) {
      socket.emit('typing', { recipientId: selectedUser?.userId });
      clearTimeout(window.typingTimeout);
      window.typingTimeout = setTimeout(() => socket.emit('stopTyping', { recipientId: selectedUser?.userId }), 1000);
    }
  };

  const onEmojiClick = (emojiObject) => {
    setMessage((prev) => prev + emojiObject.emoji);
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL || 'https://chat-app-backend-mgik.onrender.com'}/api/auth/logout`, {}, { withCredentials: true });
      localStorage.removeItem('token');
      if (socket) socket.disconnect();
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleClearPublicChat = async () => {
    if (window.confirm("Are you sure you want to clear all public chat messages? This action cannot be undone.")) {
      try {
        await axios.delete(`${process.env.REACT_APP_API_URL || 'https://chat-app-backend-mgik.onrender.com'}/messages/public`, {
          withCredentials: true,
        });
      } catch (err) {
        console.error('Error clearing public chat:', err);
        alert('Failed to clear public chat. Please try again.');
      }
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
          <MessageCircle className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
          <p className="text-white text-xl font-semibold text-center">Please log in to continue</p>
          <p className="text-gray-400 text-center mt-2">Your session has expired</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Sidebar */}
      <div className={`w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg flex flex-col`}>
        <div className={`p-4 ${isDarkMode ? 'bg-indigo-700' : 'bg-gradient-to-r from-indigo-600 to-purple-600'} text-white`}>
          <h3 className="text-lg font-semibold">Online Users</h3>
          {/* Using the Users icon here */}
          <Users className="inline-block w-5 h-5 ml-2" />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {/* Public Chat option in sidebar */}
          <div
            className={`flex items-center p-3 rounded-lg cursor-pointer ${!selectedUser && activeTab === 'public' ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-200') : ''} hover:${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
            onClick={() => { setSelectedUser(null); setActiveTab('public'); }}
          >
            <Globe className="w-5 h-5 mr-2 text-green-500" />
            <span className="text-sm font-medium">Public Chat</span>
          </div>
          {onlineUsers.map((user) => (
            <div
              key={user.userId}
              className={`flex items-center p-3 rounded-lg cursor-pointer ${selectedUser?.userId === user.userId ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-200') : ''} hover:${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
              onClick={() => { setSelectedUser(user); setActiveTab('private'); }}
            >
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              <span className="text-sm font-medium">{user.username}</span>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className={`p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-md flex justify-between items-center`}>
          <h2 className="text-xl font-semibold">
            {selectedUser ? `Chat with ${selectedUser.username}` : 'Public Chat Room'}
          </h2>
          <div className="space-x-2 flex items-center">
            {!selectedUser && activeTab === 'public' && (
              <button
                onClick={handleClearPublicChat}
                className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 flex items-center gap-1" // Added flex for icon
              >
                <Trash2 className="w-4 h-4" /> {/* Using the Trash2 icon here */}
                Clear Chat
              </button>
            )}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg text-sm font-medium ${isDarkMode ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className={`flex-1 overflow-y-auto p-4 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <div className="space-y-4">
            {activeTab === 'public' ? (
              messages.length > 0 ? (
                messages.map((msg) => (
                  <div key={msg._id} className="flex mb-4 animate-slide-in">
                    <div className={`inline-block p-3 rounded-lg shadow-md ${isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'}`}>
                      <div className="flex items-center space-x-2">
                        <strong className="text-sm">{msg.sender?.username || 'Unknown'}</strong>
                        <span className="text-xs opacity-75">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="mt-1">{msg.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Globe className={`w-16 h-16 mx-auto mb-4 opacity-50 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
                  <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No messages yet</p>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Start the conversation!</p>
                </div>
              )
            ) : (
              privateMessages.length > 0 ? (
                privateMessages.map((msg) => (
                  <div key={msg._id} className="flex mb-4 animate-slide-in">
                    <div className={`inline-block p-3 rounded-lg shadow-md ${isDarkMode ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white'}`}>
                      <div className="flex items-center space-x-2">
                        <strong className="text-sm">{msg.sender?.username || 'Unknown'}</strong>
                        {msg.recipient && (
                            <span className="text-xs opacity-75">→ {msg.recipient?.username || 'Unknown'}</span>
                        )}
                        <span className="text-xs opacity-75 ml-auto">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="mt-1">{msg.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Lock className={`w-16 h-16 mx-auto mb-4 opacity-50 ${isDarkMode ? 'text-purple-400' : 'text-purple-500'}`} />
                  <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No private messages</p>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Select a user to start chatting privately</p>
                </div>
              )
            )}
             <div ref={messagesEndRef} />
          </div>
          {typingUser && (
            <p className={`text-sm mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} animate-fade-in`}>{typingUser} is typing...</p>
          )}
        </div>

        {/* Input Area */}
        <div className={`p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-md relative`}>
          {showEmojiPicker && (
            <div className="absolute bottom-20 right-4 z-10">
              <Picker onEmojiClick={onEmojiClick} theme={isDarkMode ? 'dark' : 'light'} />
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 rounded-lg hover:bg-gray-200"
            >
              😊
            </button>
            <input
              type="text"
              value={message}
              onChange={handleTyping}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(e)}
              placeholder={selectedUser ? `Message ${selectedUser.username}...` : 'Type your message...'}
              className={`flex-1 p-2 rounded-lg border ${isDarkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !message.trim()}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1" // Added flex for icon
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{isSending ? 'Sending...' : 'Send'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Chat;