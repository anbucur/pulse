import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin (stub for now, requires service account in production)
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      // credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (e) {
  console.error('Firebase Admin init error:', e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/notify", async (req, res) => {
    const { toUid, title, body, data } = req.body;
    
    try {
      // In a real app, we'd fetch the user's FCM token from Firestore using admin SDK
      // const userDoc = await admin.firestore().collection('users').doc(toUid).get();
      // const token = userDoc.data()?.fcmToken;
      
      // if (token) {
      //   await admin.messaging().send({
      //     token,
      //     notification: { title, body },
      //     data: data || {}
      //   });
      // }
      
      console.log(`[STUB NOTIFY API] To: ${toUid} | Title: ${title} | Body: ${body}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
