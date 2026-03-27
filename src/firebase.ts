import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging as _getMessaging, isSupported } from 'firebase/messaging';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
export const storage = getStorage(app);

// Lazily initialized messaging instance
let _messagingInstance: ReturnType<typeof _getMessaging> | null = null;

export const getMessagingInstance = async () => {
  if (_messagingInstance) return _messagingInstance;
  const supported = await isSupported();
  if (supported) {
    _messagingInstance = _getMessaging(app);
    return _messagingInstance;
  }
  return null;
};
