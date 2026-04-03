import React, { useState, useEffect } from 'react';
import { Lock, MessageSquare, Plus, Users, Clock, Flame, Shield, Send, Eye, EyeOff } from 'lucide-react';

interface BurnerChat {
  id: string;
  room_name: string;
  created_by: string;
  max_lifetime: number;
  max_messages: number;
  destruct_on_read: boolean;
  destruct_timer: number;
  created_at: string;
  expires_at: string;
}

interface BurnerMessage {
  id: string;
  sender_id: string;
  encrypted_content: string;
  view_count: number;
  max_views: number;
  destruct_at: string;
  created_at: string;
}

export default function BurnerChat() {
  const [activeChats, setActiveChats] = useState<BurnerChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<BurnerChat | null>(null);
  const [messages, setMessages] = useState<BurnerMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newChatSettings, setNewChatSettings] = useState({
    roomName: '',
    maxLifetime: 3600, // 1 hour
    maxMessages: 100,
    destructOnRead: false,
    destructTimer: 60,
  });

  useEffect(() => {
    fetchActiveChats();
  }, []);

  const fetchActiveChats = async () => {
    const token = localStorage.getItem('token');
    try {
      // Get all burner chats where user is participant
      const response = await fetch('/api/features/burner', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter to active chats and those where user is participant
        setActiveChats(data.filter((chat: BurnerChat) =>
          new Date(chat.expires_at) > new Date()
        ));
      }
    } catch (error) {
      console.error('Error fetching burner chats:', error);
    }
  };

  const createBurnerChat = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/features/burner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newChatSettings),
      });

      if (response.ok) {
        const chat = await response.json();
        setActiveChats([...activeChats, chat]);
        setShowCreateForm(false);
        setSelectedChat(chat);
      }
    } catch (error) {
      console.error('Error creating burner chat:', error);
    } finally {
      setCreating(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    const token = localStorage.getItem('token');
    try {
      // In production, encrypt message client-side
      const encryptedContent = btoa(newMessage); // Simple encoding - use real encryption

      const response = await fetch(`/api/features/burner/${selectedChat.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          encryptedContent,
          nonce: 'random-nonce', // In production, generate real nonce
          maxViews: selectedChat.destruct_on_read ? 1 : 5,
        }),
      });

      if (response.ok) {
        setNewMessage('');
        fetchMessages(selectedChat.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const fetchMessages = async (chatId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/features/burner/${chatId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const viewMessage = async (messageId: string) => {
    if (!selectedChat) return;

    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/features/burner/${selectedChat.id}/messages/${messageId}/view`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      fetchMessages(selectedChat.id);
    } catch (error) {
      console.error('Error viewing message:', error);
    }
  };

  const leaveChat = async () => {
    if (!selectedChat) return;

    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/features/burner/${selectedChat.id}/leave`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      setSelectedChat(null);
      setMessages([]);
      fetchActiveChats();
    } catch (error) {
      console.error('Error leaving chat:', error);
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Burner Chat
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Temporary, encrypted chat rooms that auto-destruct
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Burner Chat
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-black/20 rounded-lg p-4 mb-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Room Name</label>
            <input
              type="text"
              value={newChatSettings.roomName}
              onChange={(e) => setNewChatSettings({ ...newChatSettings, roomName: e.target.value })}
              placeholder="e.g., Quick Chat"
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Lifetime: {newChatSettings.maxLifetime / 60} minutes
            </label>
            <input
              type="range"
              min="300"
              max="86400"
              step="300"
              value={newChatSettings.maxLifetime}
              onChange={(e) => setNewChatSettings({ ...newChatSettings, maxLifetime: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Messages</label>
            <input
              type="number"
              value={newChatSettings.maxMessages}
              onChange={(e) => setNewChatSettings({ ...newChatSettings, maxMessages: parseInt(e.target.value) })}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="destructOnRead"
              checked={newChatSettings.destructOnRead}
              onChange={(e) => setNewChatSettings({ ...newChatSettings, destructOnRead: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="destructOnRead" className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Destruct after first read
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={createBurnerChat}
              disabled={creating || !newChatSettings.roomName}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Burner Chat'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Chats List */}
        <div className="md:col-span-1 space-y-2">
          <h4 className="font-semibold text-sm text-gray-400 mb-2">Active Burner Chats</h4>

          {activeChats.length === 0 ? (
            <p className="text-gray-500 text-sm">No active burner chats</p>
          ) : (
            activeChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => {
                  setSelectedChat(chat);
                  fetchMessages(chat.id);
                }}
                className={`w-full text-left p-3 rounded-lg transition ${
                  selectedChat?.id === chat.id
                    ? 'bg-orange-500'
                    : 'bg-black/20 hover:bg-black/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-3 h-3" />
                  <span className="font-semibold text-sm">{chat.room_name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <Clock className="w-3 h-3" />
                  {getTimeRemaining(chat.expires_at)}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Chat Area */}
        <div className="md:col-span-2">
          {selectedChat ? (
            <div className="bg-black/20 rounded-lg p-4 h-96 flex flex-col">
              {/* Chat Header */}
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                <div>
                  <h4 className="font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    {selectedChat.room_name}
                  </h4>
                  <p className="text-xs text-gray-400">
                    {selectedChat.destruct_on_read ? (
                      <span className="flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        Messages destruct after read
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires in {getTimeRemaining(selectedChat.expires_at)}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={leaveChat}
                  className="px-3 py-1 text-sm bg-red-500/30 hover:bg-red-500/50 rounded transition"
                >
                  Leave
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {messages.map((message) => {
                  const isMine = message.sender_id === localStorage.getItem('userId'); // Would need real user ID
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-3 py-2 rounded-lg ${
                          isMine ? 'bg-orange-500' : 'bg-white/10'
                        }`}
                      >
                        {/* In production, decrypt message here */}
                        <p className="text-sm">{atob(message.encrypted_content)}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs opacity-70">
                          <span>{new Date(message.created_at).toLocaleTimeString()}</span>
                          <span>{message.view_count}/{message.max_views} views</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {messages.length === 0 && (
                  <p className="text-center text-gray-500 text-sm">No messages yet. Start the conversation!</p>
                )}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-black/20 rounded-lg p-8 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Select or create a burner chat to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
