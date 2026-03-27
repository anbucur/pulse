/// <reference types="vite/client" />
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, doc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Send, Image as ImageIcon, Sparkles, Loader2, Bot, Camera, X, Eye, EyeOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { GoogleGenAI } from '@google/genai';
import Webcam from 'react-webcam';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isRead: boolean;
  mediaUrl?: string;
  isViewOnce?: boolean;
  viewedAt?: number;
}

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [isGeneratingIcebreaker, setIsGeneratingIcebreaker] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    if (!user || !chatId) return;

    // Fetch both profiles for AI context
    const fetchProfiles = async () => {
      const myDoc = await getDoc(doc(db, 'public_profiles', user.uid));
      if (myDoc.exists()) setMyProfile(myDoc.data());

      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
        const otherUid = chatDoc.data().participants.find((id: string) => id !== user.uid);
        if (otherUid) {
          const profileDoc = await getDoc(doc(db, 'public_profiles', otherUid));
          if (profileDoc.exists()) {
            setOtherUser(profileDoc.data());
          }
        }
      }
    };
    fetchProfiles();

    // Listen for messages
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedMessages: Message[] = [];
      const unreadMessagesToUpdate: string[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedMessages.push({ id: doc.id, ...data } as Message);
        
        if (!data.isRead && data.senderId !== user.uid) {
          unreadMessagesToUpdate.push(doc.id);
        }
      });
      
      setMessages(fetchedMessages);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

      // Mark messages as read
      if (unreadMessagesToUpdate.length > 0) {
        unreadMessagesToUpdate.forEach(async (msgId) => {
          try {
            await updateDoc(doc(db, `chats/${chatId}/messages`, msgId), {
              isRead: true
            });
          } catch (error) {
            console.error("Error marking message as read:", error);
          }
        });

        // Reset unread count for current user
        try {
          await updateDoc(doc(db, 'chats', chatId), {
            [`unreadCount.${user.uid}`]: 0
          });
        } catch (error) {
          console.error("Error resetting unread count:", error);
        }
      }
    });

    return unsubscribe;
  }, [chatId, user]);

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string, isViewOnce?: boolean) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !mediaUrl) || !user || !chatId) return;

    const messageText = newMessage;
    setNewMessage('');

    try {
      const messageData: any = {
        senderId: user.uid,
        text: messageText,
        timestamp: Date.now(),
        isRead: false
      };

      if (mediaUrl) {
        messageData.mediaUrl = mediaUrl;
        if (isViewOnce) {
          messageData.isViewOnce = true;
        }
      }

      await addDoc(collection(db, `chats/${chatId}/messages`), messageData);

      const otherUid = otherUser?.uid || (await getDoc(doc(db, 'chats', chatId))).data()?.participants.find((id: string) => id !== user.uid);

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: isViewOnce ? '📸 View-Once Photo' : mediaUrl ? '📸 Photo' : messageText,
        updatedAt: Date.now(),
        ...(otherUid ? { [`unreadCount.${otherUid}`]: increment(1) } : {})
      });

      // Auto-reply for demo profiles
      if (otherUid && otherUid.startsWith('demo_')) {
        setTimeout(async () => {
          try {
            const genericReplies = [
              "Hey there! I'm just a demo profile.",
              "That's interesting! Tell me more.",
              "Haha, nice.",
              "Cool! How's your day going?",
              "I'm a bot, but I appreciate the message!",
              "Sounds good to me.",
              "Let's see where this goes."
            ];
            const replyText = genericReplies[Math.floor(Math.random() * genericReplies.length)];
            
            await addDoc(collection(db, `chats/${chatId}/messages`), {
              senderId: otherUid,
              text: replyText,
              timestamp: Date.now(),
              isRead: false
            });

            await updateDoc(doc(db, 'chats', chatId), {
              lastMessage: replyText,
              updatedAt: Date.now(),
              [`unreadCount.${user.uid}`]: increment(1)
            });
          } catch (err) {
            console.error("Error sending demo reply:", err);
          }
        }, 5000);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      handleSendMessage(undefined, imageSrc, true);
      setShowCamera(false);
    }
  }, [webcamRef]);

  const handleViewMedia = async (msg: Message) => {
    if (msg.senderId === user?.uid) return; // Can't view own view-once media
    if (msg.viewedAt) return; // Already viewed

    setViewingMedia(msg);

    try {
      await updateDoc(doc(db, `chats/${chatId}/messages`, msg.id), {
        viewedAt: Date.now()
      });
    } catch (error) {
      console.error("Error updating viewed status:", error);
    }
  };

  const closeMediaView = () => {
    setViewingMedia(null);
  };

  const generateIcebreaker = async () => {
    if (!myProfile || !otherUser) return;
    setIsGeneratingIcebreaker(true);
    
    try {
      const prompt = `
        You are an AI wingman for a dating app called Pulse.
        Generate a short, engaging, and contextual icebreaker message for me to send to this user.
        
        My Profile:
        Intent: ${myProfile.intent}
        Role: ${myProfile.sexualRole}
        Bio: ${myProfile.bio}
        
        Their Profile:
        Name: ${otherUser.displayName}
        Intent: ${otherUser.intent}
        Role: ${otherUser.sexualRole}
        Bio: ${otherUser.bio}
        
        Return ONLY the text of the suggested message. Keep it under 150 characters. Be casual and direct.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (response.text) {
        setNewMessage(response.text.trim().replace(/^["']|["']$/g, ''));
      }
    } catch (error) {
      console.error("Error generating icebreaker:", error);
    } finally {
      setIsGeneratingIcebreaker(false);
    }
  };

  const generateReply = async () => {
    if (!myProfile || !otherUser || messages.length === 0) return;
    setIsGeneratingReply(true);
    
    try {
      const recentMessages = messages.slice(-5).map(m => 
        `${m.senderId === user?.uid ? 'Me' : otherUser.displayName}: ${m.text || (m.isViewOnce ? '[Photo]' : '')}`
      ).join('\n');

      const prompt = `
        You are an AI wingman for a dating app called Pulse.
        Generate a short, engaging reply for me to send based on the recent conversation history.
        
        My Profile:
        Intent: ${myProfile.intent}
        Role: ${myProfile.sexualRole}
        
        Their Profile:
        Name: ${otherUser.displayName}
        Intent: ${otherUser.intent}
        Role: ${otherUser.sexualRole}
        
        Recent Conversation:
        ${recentMessages}
        
        Return ONLY the text of the suggested reply. Keep it under 150 characters. Match the tone of the conversation.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (response.text) {
        setNewMessage(response.text.trim().replace(/^["']|["']$/g, ''));
      }
    } catch (error) {
      console.error("Error generating reply:", error);
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
              src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chatId}`} 
              alt={otherUser?.displayName || 'User'} 
              className="w-10 h-10 rounded-full object-cover border border-zinc-700"
              referrerPolicy="no-referrer"
            />
            <div className="ml-3">
              <h2 className="font-semibold text-zinc-100">{otherUser?.displayName || 'Loading...'}</h2>
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
                src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chatId}`} 
                alt={otherUser?.displayName || 'User'} 
                className="w-20 h-20 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <p>You matched with {otherUser?.displayName}. Say hi!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
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
                ) : null}
                
                {msg.text && <p className="text-sm">{msg.text}</p>}
                
                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-rose-200' : 'text-zinc-500'}`}>
                  {formatDistanceToNow(msg.timestamp, { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-zinc-900 border-t border-zinc-800 p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <button 
            type="button" 
            onClick={() => setShowCamera(true)}
            className="p-2 text-zinc-400 hover:text-rose-500 transition-colors"
            title="Send View-Once Photo"
          >
            <Camera className="w-6 h-6" />
          </button>
          
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

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim()}
            className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <div className="relative w-full max-w-md">
            {/* @ts-ignore */}
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              className="w-full h-auto rounded-2xl"
            />
            <button 
              onClick={() => setShowCamera(false)}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <button 
                onClick={capturePhoto}
                className="w-16 h-16 bg-white rounded-full border-4 border-zinc-300 flex items-center justify-center hover:scale-105 transition-transform"
              >
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
            <button 
              onClick={closeMediaView}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="absolute top-4 left-4 bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center">
              <Eye className="w-3 h-3 mr-1" /> View Once
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
