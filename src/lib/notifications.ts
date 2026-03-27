/// <reference types="vite/client" />
import { getToken } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db, getMessagingInstance } from '../firebase';

export const registerFCMToken = async (uid: string) => {
  const messaging = await getMessagingInstance();
  if (!messaging) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY;
      if (!vapidKey) {
        console.warn('VITE_FCM_VAPID_KEY is not set — push notifications disabled');
        return;
      }
      const token = await getToken(messaging, { vapidKey });
      if (token) {
        await updateDoc(doc(db, 'users', uid), { fcmToken: token });
      }
    }
  } catch (error) {
    console.error('Error registering FCM token:', error);
  }
};

export const sendNotification = async (toUid: string, title: string, body: string, data?: Record<string, string>) => {
  try {
    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;

    await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ toUid, title, body, data }),
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
