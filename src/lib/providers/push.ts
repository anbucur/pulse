// Push Notification Provider Interface
export interface PushNotification {
  to: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  badge?: string;
  image?: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface IPushProvider {
  subscribe(userId: string, subscription: PushSubscription): Promise<void>;
  unsubscribe(userId: string, subscription: PushSubscription): Promise<void>;
  send(notification: PushNotification): Promise<void>;
  sendToUser(userId: string, notification: Omit<PushNotification, 'to'>): Promise<void>;
  sendToUsers(userIds: string[], notification: Omit<PushNotification, 'to'>): Promise<void>;
}

// Web Push Implementation
export class PushProvider implements IPushProvider {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;

  constructor() {
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
  }

  async subscribe(userId: string, subscription: PushSubscription): Promise<void> {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ userId, subscription })
    });
  }

  async unsubscribe(userId: string, subscription: PushSubscription): Promise<void> {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ userId, subscription })
    });
  }

  async send(notification: PushNotification): Promise<void> {
    await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(notification)
    });
  }

  async sendToUser(userId: string, notification: Omit<PushNotification, 'to'>): Promise<void> {
    await fetch('/api/push/send-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ userId, ...notification })
    });
  }

  async sendToUsers(userIds: string[], notification: Omit<PushNotification, 'to'>): Promise<void> {
    await fetch('/api/push/send-bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ userIds, ...notification })
    });
  }
}

export const pushProvider = new PushProvider();
