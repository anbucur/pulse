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

// -------------------------------------------------------------------------
// Provider plan definitions
// -------------------------------------------------------------------------
export const PROVIDER_PLANS = {
  token_minimax: {
    label: 'Minimax Token Plan',
    provider: 'minimax',
    monthlyTokens: 5_000_000,
    priceUsd: 14.99,
  },
  token_anthropic: {
    label: 'Anthropic Token Plan',
    provider: 'anthropic',
    monthlyTokens: 1_000_000,
    priceUsd: 24.99,
  },
  coding_zai: {
    label: 'z.ai Coding Plan',
    provider: 'zai',
    monthlyTokens: 2_000_000,
    priceUsd: 19.99,
  },
} as const;

export type ProviderPlanId = keyof typeof PROVIDER_PLANS;

// -------------------------------------------------------------------------
// Provider helper: Anthropic (claude-3-5-haiku-20241022)
// -------------------------------------------------------------------------
async function callAnthropic(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);
  const data = await response.json() as any;
  return data.content?.[0]?.text ?? '';
}

// -------------------------------------------------------------------------
// Provider helper: Minimax.io (OpenAI-compatible endpoint)
// -------------------------------------------------------------------------
async function callMinimax(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.minimax.io/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MINIMAX_API_KEY || ''}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Minimax API error: ${response.status}`);
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? '';
}

// -------------------------------------------------------------------------
// Provider helper: z.ai (OpenAI-compatible, coding-optimised)
// -------------------------------------------------------------------------
async function callZai(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.z.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ZAI_API_KEY || ''}`,
    },
    body: JSON.stringify({
      model: 'glm-5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!response.ok) throw new Error(`z.ai API error: ${response.status}`);
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? '';
}

// -------------------------------------------------------------------------
// Token tracking: deduct tokens from user's balance in Firestore
// Returns false if insufficient balance
// -------------------------------------------------------------------------
async function deductTokens(uid: string, tokensUsed: number): Promise<boolean> {
  const userRef = admin.firestore().collection('users').doc(uid);
  try {
    await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const balance: number = snap.data()?.tokenBalance ?? 0;
      if (balance < tokensUsed) throw new Error('insufficient_tokens');
      tx.update(userRef, {
        tokenBalance: balance - tokensUsed,
        tokenUsed: (snap.data()?.tokenUsed ?? 0) + tokensUsed,
      });
    });
    return true;
  } catch (err: any) {
    if (err.message === 'insufficient_tokens') return false;
    throw err;
  }
}

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
  // Plan: Get current plan status and token balance
  // -----------------------------------------------------------------------
  app.get("/api/plan/status", verifyToken, async (req, res) => {
    const uid = (req as any).uid as string;
    try {
      const snap = await admin.firestore().collection('users').doc(uid).get();
      const data = snap.data() ?? {};
      res.json({
        plan: data.plan ?? 'free',
        tokenBalance: data.tokenBalance ?? 0,
        tokenUsed: data.tokenUsed ?? 0,
      });
    } catch (error) {
      console.error('Error in /api/plan/status:', error);
      res.status(500).json({ error: 'Failed to fetch plan status' });
    }
  });

  // -----------------------------------------------------------------------
  // Plan: Upgrade to a provider token plan
  // -----------------------------------------------------------------------
  app.post("/api/plan/upgrade", verifyToken, async (req, res) => {
    const uid = (req as any).uid as string;
    const { planId } = req.body as { planId: ProviderPlanId };
    if (!PROVIDER_PLANS[planId]) {
      res.status(400).json({ error: 'Unknown plan' });
      return;
    }
    const plan = PROVIDER_PLANS[planId];
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    try {
      await admin.firestore().collection('users').doc(uid).update({
        plan: planId,
        tokenBalance: plan.monthlyTokens,
        tokenUsed: 0,
        planExpiresAt: expiresAt,
      });
      res.json({ success: true, plan: planId, tokenBalance: plan.monthlyTokens });
    } catch (error) {
      console.error('Error in /api/plan/upgrade:', error);
      res.status(500).json({ error: 'Failed to upgrade plan' });
    }
  });

  // -----------------------------------------------------------------------
  // AI: Coding assistant (z.ai Coding Plan)
  // -----------------------------------------------------------------------
  app.post("/api/ai/coding", verifyToken, async (req, res) => {
    const uid = (req as any).uid as string;
    const { code, question, language } = req.body as { code?: string; question: string; language?: string };

    // Verify user is on coding_zai plan
    const userSnap = await admin.firestore().collection('users').doc(uid).get();
    if (userSnap.data()?.plan !== 'coding_zai') {
      res.status(403).json({ error: 'The z.ai Coding Plan is required for this feature.' });
      return;
    }

    // Estimate token usage (rough: 4 chars ≈ 1 token)
    const estimatedTokens = Math.ceil(((code?.length ?? 0) + question.length + 500) / 4);
    const hasBalance = await deductTokens(uid, estimatedTokens);
    if (!hasBalance) {
      res.status(402).json({ error: 'Insufficient token balance. Please top up your plan.' });
      return;
    }

    try {
      const systemPrompt = `You are an expert software engineer and coding assistant. Provide clear, concise, and correct code help. When showing code use proper formatting.${language ? ` The user is working in ${language}.` : ''}`;
      const userMessage = code
        ? `Here is my code:\n\`\`\`${language ?? ''}\n${code}\n\`\`\`\n\nQuestion: ${question}`
        : question;

      const answer = await callZai(systemPrompt, userMessage);
      res.json({ answer });
    } catch (error) {
      console.error('Error in /api/ai/coding:', error);
      res.status(500).json({ error: 'Coding AI unavailable' });
    }
  });

  // -----------------------------------------------------------------------
  // AI: Provider-aware bio optimizer (Minimax or Anthropic based on plan)
  // -----------------------------------------------------------------------
  app.post("/api/ai/optimize-bio-pro", verifyToken, async (req, res) => {
    const uid = (req as any).uid as string;
    const { bio, intent, sexualRole, age } = req.body;

    const userSnap = await admin.firestore().collection('users').doc(uid).get();
    const plan: string = userSnap.data()?.plan ?? 'free';

    if (plan !== 'token_minimax' && plan !== 'token_anthropic') {
      res.status(403).json({ error: 'A Minimax or Anthropic token plan is required.' });
      return;
    }

    const estimatedTokens = Math.ceil(((bio?.length ?? 0) + 300) / 4);
    const hasBalance = await deductTokens(uid, estimatedTokens);
    if (!hasBalance) {
      res.status(402).json({ error: 'Insufficient token balance. Please top up your plan.' });
      return;
    }

    try {
      const systemPrompt = 'You are a dating profile coach for a queer dating app called Pulse. Rewrite bios to be engaging, authentic, and concise (under 300 characters).';
      const userMessage = `Bio: ${bio || 'None'}\nIntent: ${intent}\nRole: ${sexualRole}\nAge: ${age}\n\nRewrite the bio only. Output the bio text with no extra commentary.`;

      const result = plan === 'token_minimax'
        ? await callMinimax(systemPrompt, userMessage)
        : await callAnthropic(systemPrompt, userMessage);

      res.json({ bio: result.trim() || bio });
    } catch (error) {
      console.error('Error in /api/ai/optimize-bio-pro:', error);
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
