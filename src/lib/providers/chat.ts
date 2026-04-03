// Chat Provider Interface
export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isRead: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  isViewOnce?: boolean;
  viewedAt?: number;
  replyTo?: string;
  reactions?: Array<{ userId: string; emoji: string }>;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: ChatMessage;
  unreadCount: Record<string, number>;
  typing: Record<string, boolean>;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface TypingIndicator {
  chatId: string;
  userId: string;
  isTyping: boolean;
}

export interface IChatProvider {
  createRoom(participants: string[]): Promise<ChatRoom>;
  getRoom(roomId: string): Promise<ChatRoom>;
  getUserRooms(userId: string): Promise<ChatRoom[]>;
  sendMessage(roomId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage>;
  markAsRead(roomId: string, userId: string): Promise<void>;
  deleteMessage(roomId: string, messageId: string): Promise<void>;
  onMessage(roomId: string, callback: (message: ChatMessage) => void): () => void;
  onTyping(callback: (indicator: TypingIndicator) => void): () => void;
  sendTyping(roomId: string, isTyping: boolean): void;
  connect(): void;
  disconnect(): void;
}

// WebSocket Implementation
export class ChatProvider implements IChatProvider {
  private socket: WebSocket | null = null;
  private messageCallbacks: Map<string, Set<(message: ChatMessage) => void>> = new Map();
  private typingCallbacks: Set<(indicator: TypingIndicator) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  private get wsUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    const token = localStorage.getItem('token');
    this.socket = new WebSocket(`${this.wsUrl}?token=${token}`);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      console.log('WebSocket connected');
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'message') {
        const callbacks = this.messageCallbacks.get(data.roomId);
        callbacks?.forEach(cb => cb(data.message));
      } else if (data.type === 'typing') {
        this.typingCallbacks.forEach(cb => cb(data.indicator));
      }
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  async createRoom(participants: string[]): Promise<ChatRoom> {
    const response = await fetch('/api/chat/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ participants })
    });

    if (!response.ok) throw new Error('Failed to create room');
    return response.json();
  }

  async getRoom(roomId: string): Promise<ChatRoom> {
    const response = await fetch(`/api/chat/rooms/${roomId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to get room');
    return response.json();
  }

  async getUserRooms(userId: string): Promise<ChatRoom[]> {
    const response = await fetch(`/api/chat/rooms?userId=${userId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to get rooms');
    return response.json();
  }

  async sendMessage(roomId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const response = await fetch(`/api/chat/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  }

  async markAsRead(roomId: string, userId: string): Promise<void> {
    await fetch(`/api/chat/rooms/${roomId}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ userId })
    });
  }

  async deleteMessage(roomId: string, messageId: string): Promise<void> {
    await fetch(`/api/chat/rooms/${roomId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
  }

  onMessage(roomId: string, callback: (message: ChatMessage) => void): () => void {
    if (!this.messageCallbacks.has(roomId)) {
      this.messageCallbacks.set(roomId, new Set());
    }
    this.messageCallbacks.get(roomId)!.add(callback);

    return () => {
      this.messageCallbacks.get(roomId)?.delete(callback);
    };
  }

  onTyping(callback: (indicator: TypingIndicator) => void): () => void {
    this.typingCallbacks.add(callback);

    return () => {
      this.typingCallbacks.delete(callback);
    };
  }

  sendTyping(roomId: string, isTyping: boolean): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'typing',
        roomId,
        isTyping
      }));
    }
  }
}

export const chatProvider = new ChatProvider();
