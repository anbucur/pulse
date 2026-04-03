import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { chatProvider, aiProvider, storageProvider } from '../lib/providers';
import type { ChatMessage } from '../lib/providers';
import { ArrowLeft, Send, Image as ImageIcon, Sparkles, Loader2, Bot, Camera, X, Eye, EyeOff, Mic, Square, Trash2, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Webcam from 'react-webcam';

interface Profile {
  display_name: string;
  photos?: string[];
}

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [isGeneratingIcebreaker, setIsGeneratingIcebreaker] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<ChatMessage | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showSavedPhrases, setShowSavedPhrases] = useState(false);
  const [savedPhrases, setSavedPhrases] = useState<{id: string, text: string}[]>([]);
  const [newPhrase, setNewPhrase] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/chat/rooms/${chatId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [chatId]);

  // Fetch room info and profiles
  useEffect(() => {
    if (!user || !chatId) return;

    const token = localStorage.getItem('token');

    // Fetch room details
    fetch(`/api/chat/rooms/${chatId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(async (room) => {
        // Find the other user
        const otherUserId = room.participants?.find((id: string) => id !== user.id);
        if (otherUserId) {
          const profileRes = await fetch(`/api/profiles/${otherUserId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (profileRes.ok) {
            setOtherUser(await profileRes.json());
          }
        }
      })
      .catch(console.error);

    // Fetch my profile
    fetch('/api/profiles/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(setMyProfile)
      .catch(console.error);

    fetchMessages();
  }, [chatId, user, fetchMessages]);

  // WebSocket listeners
  useEffect(() => {
    if (!chatId) return;

    const unsubscribeMessage = chatProvider.onMessage(chatId, (message) => {
      setMessages(prev => [...prev, message]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

      // Mark as read
      if (user && message.senderId !== user.id) {
        chatProvider.markAsRead(chatId, user.id).catch(console.error);
      }
    });

    const unsubscribeTyping = chatProvider.onTyping((indicator) => {
      if (indicator.chatId === chatId && indicator.userId !== user?.id) {
        setOtherUserTyping(indicator.isTyping);
      }
    });

    return () => {
      unsubscribeMessage();
      unsubscribeTyping();
    };
  }, [chatId, user]);

  // Fetch saved phrases
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/chat/saved-phrases', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then(setSavedPhrases)
      .catch(() => {});
  }, [user]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (chatId) {
      chatProvider.sendTyping(chatId, true);
      setTimeout(() => chatProvider.sendTyping(chatId, false), 2000);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!chatId || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      const result = await storageProvider.upload(file, { folder: `chats/${chatId}` });
      handleSendMessage(undefined, result.url, false);
    } catch (error) {
      console.error('Error uploading media:', error);
      alert('Failed to upload media.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        if (chatId) {
          try {
            const result = await storageProvider.upload(new File([audioBlob], 'audio.webm', { type: 'audio/webm' }), { folder: `chats/${chatId}` });
            await chatProvider.sendMessage(chatId, {
              senderId: user!.id,
              text: '',
              mediaUrl: result.url,
              mediaType: 'audio',
              isRead: false,
            });
          } catch (error) {
            console.error('Error uploading audio:', error);
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const handleUnsendMessage = async (msgId: string) => {
    if (!chatId) return;
    try {
      await chatProvider.deleteMessage(chatId, msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (error) {
      console.error('Error unsending message:', error);
    }
  };

  const handleAddPhrase = async () => {
    if (!newPhrase.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/saved-phrases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: newPhrase.trim() }),
      });
      if (res.ok) {
        const phrase = await res.json();
        setSavedPhrases(prev => [...prev, phrase]);
        setNewPhrase('');
      }
    } catch (error) {
      console.error('Error adding phrase:', error);
    }
  };

  const handleDeletePhrase = async (phraseId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/chat/saved-phrases/${phraseId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setSavedPhrases(prev => prev.filter(p => p.id !== phraseId));
    } catch (error) {
      console.error('Error deleting phrase:', error);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string, isViewOnce?: boolean) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !mediaUrl) || !user || !chatId) return;

    const messageText = newMessage;
    setNewMessage('');

    try {
      await chatProvider.sendMessage(chatId, {
        senderId: user.id,
        text: messageText,
        mediaUrl,
        mediaType: mediaUrl ? 'image' : undefined,
        isViewOnce: isViewOnce || false,
        isRead: false,
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      handleSendMessage(undefined, imageSrc, true);
      setShowCamera(false);
    }
  }, [webcamRef]);

  const handleViewMedia = async (msg: ChatMessage) => {
    if (msg.senderId === user?.id || msg.viewedAt) return;
    setViewingMedia(msg);
  };

  const generateIcebreaker = async () => {
    if (!myProfile || !otherUser) return;
    setIsGeneratingIcebreaker(true);
    try {
      const result = await aiProvider.generateText(
        `Generate a short, engaging icebreaker for a dating app. My intent: ${(myProfile as any).intent?.join(', ') || 'Not specified'}. Their name: ${otherUser.display_name}. Their bio: ${(otherUser as any).bio || 'None'}. Return ONLY the message text, under 150 chars.`
      );
      if (result.text) setNewMessage(result.text.trim().replace(/^["']|["']$/g, ''));
    } catch (error) {
      console.error('Error generating icebreaker:', error);
    } finally {
      setIsGeneratingIcebreaker(false);
    }
  };

  const generateReply = async () => {
    if (!myProfile || !otherUser || messages.length === 0) return;
    setIsGeneratingReply(true);
    try {
      const recentMessages = messages.slice(-5).map(m =>
        `${m.senderId === user?.id ? 'Me' : otherUser.display_name}: ${m.text || '[Photo]'}`
      ).join('\n');

      const result = await aiProvider.generateText(
        `Generate a short reply for a dating app conversation.\n\nRecent:\n${recentMessages}\n\nReturn ONLY the reply text, under 150 chars.`
      );
      if (result.text) setNewMessage(result.text.trim().replace(/^["']|["']$/g, ''));
    } catch (error) {
      console.error('Error generating reply:', error);
    } finally {
      setIsGeneratingReply(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="mr-4 p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <div className="flex items-center">
            <img
              src={otherUser?.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chatId}`}
              alt={otherUser?.display_name || 'User'}
              className="w-10 h-10 rounded-full object-cover border border-zinc-700"
              referrerPolicy="no-referrer"
            />
            <div className="ml-3">
              <h2 className="font-semibold text-zinc-100">{otherUser?.display_name || 'Loading...'}</h2>
              <p className="text-xs text-green-500 font-medium">Online</p>
            </div>
          </div>
        </div>

        {messages.length === 0 && (
          <button
            onClick={generateIcebreaker}
            disabled={isGeneratingIcebreaker || !otherUser || !myProfile}
            className="flex items-center text-xs font-medium bg-rose-500/10 text-rose-500 px-3 py-1.5 rounded-full border border-rose-500/20 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
          >
            {isGeneratingIcebreaker ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Icebreaker
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4">
            <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
              <img
                src={otherUser?.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chatId}`}
                alt={otherUser?.display_name || 'User'}
                className="w-20 h-20 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <p>You matched with {otherUser?.display_name}. Say hi!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
              {isMe && (
                <button
                  onClick={() => handleUnsendMessage(msg.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-rose-500 transition-opacity mr-2 self-center"
                  title="Unsend message"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  isMe
                    ? 'bg-rose-600 text-white rounded-br-sm'
                    : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
                }`}
              >
                {msg.isViewOnce ? (
                  <div className="flex items-center space-x-2">
                    {isMe ? (
                      <div className="flex items-center text-rose-200">
                        <Eye className="w-4 h-4 mr-2" />
                        <span className="text-sm italic">View-Once Photo Sent</span>
                      </div>
                    ) : msg.viewedAt ? (
                      <div className="flex items-center text-zinc-500">
                        <EyeOff className="w-4 h-4 mr-2" />
                        <span className="text-sm italic">Photo Viewed</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleViewMedia(msg)}
                        className="flex items-center bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        <span className="text-sm font-medium">Tap to View</span>
                      </button>
                    )}
                  </div>
                ) : msg.mediaUrl ? (
                  <img src={msg.mediaUrl} alt="Media" className="rounded-lg max-w-full h-auto mb-2" />
                ) : msg.mediaType === 'audio' ? (
                  <audio src={msg.mediaUrl} controls className="w-48 h-10" />
                ) : null}

                {msg.text && <p className="text-sm">{msg.text}</p>}

                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-rose-200' : 'text-zinc-500'}`}>
                  {formatDistanceToNow(msg.timestamp, { addSuffix: true })}
                  {isMe && <span className="ml-1">{msg.isRead ? '• Read' : '• Delivered'}</span>}
                </p>
              </div>
            </div>
          );
        })}

        {otherUserTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 text-zinc-400 rounded-2xl rounded-bl-sm px-4 py-2 text-sm flex items-center space-x-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-zinc-900 border-t border-zinc-800 p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <button type="button" onClick={() => setShowCamera(true)} className="p-2 text-zinc-400 hover:text-rose-500 transition-colors" title="Send View-Once Photo">
            <Camera className="w-6 h-6" />
          </button>

          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-rose-500 transition-colors" title="Send Media">
            <ImageIcon className="w-6 h-6" />
          </button>
          <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleMediaUpload} />

          {messages.length > 0 && (
            <button
              type="button"
              onClick={generateReply}
              disabled={isGeneratingReply || !otherUser || !myProfile}
              className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors disabled:opacity-50"
              title="AI Wingman Reply"
            >
              {isGeneratingReply ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
            </button>
          )}

          <button type="button" onClick={() => setShowSavedPhrases(true)} className="p-2 text-zinc-400 hover:text-rose-500 transition-colors" title="Saved Phrases">
            <Bookmark className="w-5 h-5" />
          </button>

          {isRecording ? (
            <div className="flex-1 flex items-center justify-between bg-rose-500/20 border border-rose-500/50 text-rose-500 rounded-full px-4 py-2">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse mr-2"></div>
                <span className="text-sm font-medium">Recording... {recordingDuration}s</span>
              </div>
              <button type="button" onClick={stopRecording} className="p-1 hover:bg-rose-500/20 rounded-full">
                <Square className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder="Type a message..."
              className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          )}

          {newMessage.trim() || isRecording ? (
            <button type="submit" disabled={!newMessage.trim() && !isRecording} className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition-colors disabled:opacity-50">
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button type="button" onClick={startRecording} className="p-2 bg-zinc-800 text-zinc-400 rounded-full hover:bg-zinc-700 hover:text-white transition-colors">
              <Mic className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <div className="relative w-full max-w-md">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              className="w-full h-auto rounded-2xl"
            />
            <button onClick={() => setShowCamera(false)} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70">
              <X className="w-6 h-6" />
            </button>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-zinc-300 flex items-center justify-center hover:scale-105 transition-transform">
                <div className="w-12 h-12 bg-rose-500 rounded-full"></div>
              </button>
            </div>
            <div className="absolute top-4 left-4 bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center">
              <Eye className="w-3 h-3 mr-1" /> View Once
            </div>
          </div>
        </div>
      )}

      {/* View Media Modal */}
      {viewingMedia && viewingMedia.mediaUrl && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <div className="relative w-full max-w-md h-full flex items-center justify-center">
            <img src={viewingMedia.mediaUrl} alt="View Once" className="max-w-full max-h-full object-contain" />
            <button onClick={() => setViewingMedia(null)} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Saved Phrases Modal */}
      {showSavedPhrases && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Bookmark className="w-5 h-5 mr-2 text-rose-500" />
                Saved Phrases
              </h2>
              <button onClick={() => setShowSavedPhrases(false)} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto space-y-2">
              {savedPhrases.length === 0 ? (
                <p className="text-zinc-500 text-center py-4">No saved phrases yet.</p>
              ) : (
                savedPhrases.map(phrase => (
                  <div key={phrase.id} className="flex items-center justify-between bg-zinc-800 p-3 rounded-xl group">
                    <p
                      className="text-zinc-200 flex-1 cursor-pointer hover:text-white"
                      onClick={() => { setNewMessage(phrase.text); setShowSavedPhrases(false); }}
                    >
                      {phrase.text}
                    </p>
                    <button onClick={() => handleDeletePhrase(phrase.id)} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-rose-500 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 flex space-x-2">
              <input
                type="text"
                value={newPhrase}
                onChange={(e) => setNewPhrase(e.target.value)}
                placeholder="Add a new phrase..."
                className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-2 focus:outline-none focus:border-rose-500"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddPhrase(); }}
              />
              <button onClick={handleAddPhrase} disabled={!newPhrase.trim()} className="px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
