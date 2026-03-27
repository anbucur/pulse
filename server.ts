import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin SDK
// Uses Application Default Credentials (Workload Identity on Cloud Run, or
// GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key for local dev)
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
} catch (e) {
  console.error('Firebase Admin init error (AI calls will be disabled):', e);
}

// Initialize Gemini AI server-side (key never leaves the server)
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Middleware: verify Firebase ID token sent from client
async function verifyToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const idToken = authHeader.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    (req as any).uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // -----------------------------------------------------------------------
  // Health check
  // -----------------------------------------------------------------------
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // -----------------------------------------------------------------------
  // Push notifications (real FCM send via Admin SDK)
  // -----------------------------------------------------------------------
  app.post("/api/notify", verifyToken, async (req, res) => {
    const { toUid, title, body, data } = req.body;
    try {
      const userDoc = await admin.firestore().collection('users').doc(toUid).get();
      const token = userDoc.data()?.fcmToken;
      if (token) {
        await admin.messaging().send({
          token,
          notification: { title, body },
          data: data || {},
        });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  });

  // -----------------------------------------------------------------------
  // AI: Vibe Match score between two profiles
  // -----------------------------------------------------------------------
  app.post("/api/ai/vibe-match", verifyToken, async (req, res) => {
    const { myProfile, otherProfile } = req.body;
    try {
      const prompt = `
        Analyze these two dating profiles and calculate a "Vibe Match" score from 1 to 100.
        Provide a 1-sentence explanation of why they match or don't match.

        User 1 (Me):
        Intent: ${myProfile.intent}
        Role: ${myProfile.sexualRole}
        Bio: ${myProfile.bio || 'None'}

        User 2 (Them):
        Intent: ${otherProfile.intent}
        Role: ${otherProfile.sexualRole}
        Bio: ${otherProfile.bio || 'None'}

        Return JSON format: {"score": 85, "reason": "You both want to grab drinks right now and love techno."}
      `;
      const response = await genai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      res.json(JSON.parse(response.text || '{"score": 50, "reason": "Could be a match!"}'));
    } catch (error) {
      console.error("Error in /api/ai/vibe-match:", error);
      res.status(500).json({ error: 'AI unavailable' });
    }
  });

  // -----------------------------------------------------------------------
  // AI: Semantic profile search
  // -----------------------------------------------------------------------
  app.post("/api/ai/search", verifyToken, async (req, res) => {
    const { searchQuery, profiles } = req.body;
    try {
      const prompt = `
        You are an AI matchmaking assistant for a dating app.
        User query: "${searchQuery}"

        Available profiles:
        ${JSON.stringify(profiles)}

        Return a JSON array of 'uid' strings that best match the query. Only return the JSON array, no markdown formatting.
      `;
      const response = await genai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      res.json(JSON.parse(response.text || "[]"));
    } catch (error) {
      console.error("Error in /api/ai/search:", error);
      res.status(500).json({ error: 'AI unavailable' });
    }
  });

  // -----------------------------------------------------------------------
  // AI: Generate icebreaker message
  // -----------------------------------------------------------------------
  app.post("/api/ai/icebreaker", verifyToken, async (req, res) => {
    const { myProfile, otherProfile } = req.body;
    try {
      const prompt = `
        You are a helpful wingman AI for a dating app called Pulse.
        Generate a short, flirty but tasteful opening message for me to send to someone I'm interested in.

        My Profile:
        Name: ${myProfile.displayName}
        Intent: ${myProfile.intent}
        Role: ${myProfile.sexualRole}
        Bio: ${myProfile.bio || 'None'}

        Their Profile:
        Name: ${otherProfile.displayName}
        Intent: ${otherProfile.intent}
        Role: ${otherProfile.sexualRole}
        Bio: ${otherProfile.bio || 'None'}

        Return ONLY the text of the suggested message. Keep it under 150 characters. Be casual and direct.
      `;
      const response = await genai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      res.json({ text: response.text?.trim().replace(/^["']|["']$/g, '') || '' });
    } catch (error) {
      console.error("Error in /api/ai/icebreaker:", error);
      res.status(500).json({ error: 'AI unavailable' });
    }
  });

  // -----------------------------------------------------------------------
  // AI: Suggest a reply based on conversation history
  // -----------------------------------------------------------------------
  app.post("/api/ai/reply-suggest", verifyToken, async (req, res) => {
    const { myProfile, otherProfile, recentMessages } = req.body;
    try {
      const prompt = `
        You are an AI wingman for a dating app called Pulse.
        Generate a short, engaging reply for me to send based on the recent conversation history.

        My Profile:
        Intent: ${myProfile.intent}
        Role: ${myProfile.sexualRole}

        Their Profile:
        Name: ${otherProfile.displayName}
        Intent: ${otherProfile.intent}
        Role: ${otherProfile.sexualRole}

        Recent Conversation:
        ${recentMessages}

        Return ONLY the text of the suggested reply. Keep it under 150 characters. Match the tone of the conversation.
      `;
      const response = await genai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      res.json({ text: response.text?.trim().replace(/^["']|["']$/g, '') || '' });
    } catch (error) {
      console.error("Error in /api/ai/reply-suggest:", error);
      res.status(500).json({ error: 'AI unavailable' });
    }
  });

  // -----------------------------------------------------------------------
  // AI: Optimize / rewrite user bio
  // -----------------------------------------------------------------------
  app.post("/api/ai/optimize-bio", verifyToken, async (req, res) => {
    const { bio, intent, sexualRole, age } = req.body;
    try {
      const prompt = `Rewrite this dating app bio to be more engaging, attractive, and tailored to their intent. Keep it under 300 characters.
      Current Bio: ${bio || 'None'}
      Intent: ${intent}
      Role: ${sexualRole}
      Age: ${age}`;
      const response = await genai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      res.json({ bio: response.text?.trim() || bio });
    } catch (error) {
      console.error("Error in /api/ai/optimize-bio:", error);
      res.status(500).json({ error: 'AI unavailable' });
    }
  });

  // -----------------------------------------------------------------------
  // AI: Verify profile photo contains a real face
  // -----------------------------------------------------------------------
  app.post("/api/ai/verify-photo", verifyToken, async (req, res) => {
    const { base64Data } = req.body;
    try {
      const prompt = `
        Analyze this selfie for a dating app profile verification.
        Does this image contain a clear, well-lit human face?
        Return a JSON object with 'verified' (boolean) and 'reason' (string).
      `;
      const response = await genai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
          ],
        },
        config: { responseMimeType: "application/json" },
      });
      res.json(JSON.parse(response.text || '{"verified": false, "reason": "Could not parse response"}'));
    } catch (error) {
      console.error("Error in /api/ai/verify-photo:", error);
      res.status(500).json({ error: 'AI unavailable' });
    }
  });

  // -----------------------------------------------------------------------
  // AI: Profile enhancement tips
  // -----------------------------------------------------------------------
  app.post("/api/ai/profile-tips", verifyToken, async (req, res) => {
    const { profile } = req.body;
    try {
      const prompt = `
        You are a dating profile coach for a gay/queer dating app called Pulse.
        Analyze this user's profile and suggest 3-5 specific, actionable improvements.

        Profile:
        Bio: ${profile.bio || 'None'}
        Intent: ${profile.intent}
        Role: ${profile.sexualRole}
        Tags: ${(profile.tags || []).join(', ') || 'None'}
        Tribes: ${(profile.tribes || []).join(', ') || 'None'}
        Has Photo: ${!!profile.photoURL}
        Age: ${profile.age}

        Return JSON: {"tips": [{"field": "bio", "suggestion": "Your bio is great! Consider adding...", "newValue": "optional pre-filled value if applicable"}]}
        Field options: "bio", "tags", "tribes", "intent", "photo"
        Only include newValue when you have a concrete suggestion (e.g. a rewritten bio).
      `;
      const response = await genai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      res.json(JSON.parse(response.text || '{"tips": []}'));
    } catch (error) {
      console.error("Error in /api/ai/profile-tips:", error);
      res.status(500).json({ error: 'AI unavailable' });
    }
  });

  // -----------------------------------------------------------------------
  // Vite middleware (dev) / static assets (production)
  // -----------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
