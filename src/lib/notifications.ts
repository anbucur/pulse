import { getToken } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db, getMessagingInstance } from '../firebase';

export const registerFCMToken = async (uid: string) => {
  const messaging = await getMessagingInstance();
  if (!messaging) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: process.env.VITE_FCM_VAPID_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeZ1vvk0n5CGsqI2yZ-5Hbg0vw19sZaO0QCPqcVcg-vtM01NdF8s'
      });
      if (token) {
        await updateDoc(doc(db, 'users', uid), {
          fcmToken: token
        });
      }
    }
  } catch (error) {
    console.error('Error registering FCM token:', error);
  }
};

export const sendNotification = async (toUid: string, title: string, body: string, data?: any) => {
  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUid, title, body, data }),
    });
    if (!response.ok) {
      console.log(`[STUB NOTIFICATION] To: ${toUid} | Title: ${title} | Body: ${body}`);
    }
  } catch (error) {
    console.log(`[STUB NOTIFICATION] To: ${toUid} | Title: ${title} | Body: ${body}`);
  }
};
