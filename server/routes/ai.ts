import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { GoogleGenAI } from '@google/genai';
import { aiConfig } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// All AI routes require authentication
router.use(authenticate);

// Initialize AI client
const getAIClient = () => {
  if (!aiConfig.geminiApiKey) {
    throw new AppError('AI service not configured', 500);
  }
  return new GoogleGenAI({ apiKey: aiConfig.geminiApiKey });
};

// Generate text
router.post('/generate', asyncHandler(async (req: AuthRequest, res) => {
  const { prompt, model = 'gemini-2.0-flash-exp', temperature = 0.7, maxTokens = 1000, systemPrompt } = req.body;

  if (!prompt) {
    throw new AppError('Prompt is required', 400);
  }

  const ai = getAIClient();

  let contents = prompt;
  if (systemPrompt) {
    contents = `${systemPrompt}\n\n${prompt}`;
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  res.json({
    text: response.text,
    usage: response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount || 0,
      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata.totalTokenCount || 0,
    } : undefined,
  });
}));

// Chat completion
router.post('/chat', asyncHandler(async (req: AuthRequest, res) => {
  const { messages, model = 'gemini-2.0-flash-exp', temperature = 0.7, maxTokens = 1000, systemPrompt } = req.body;

  if (!messages || !Array.isArray(messages)) {
    throw new AppError('Messages array is required', 400);
  }

  const ai = getAIClient();

  let contents = messages.map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  if (systemPrompt) {
    contents.unshift({
      role: 'user',
      parts: [{ text: `System: ${systemPrompt}` }],
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  res.json({
    text: response.text,
    usage: response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount || 0,
      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata.totalTokenCount || 0,
    } : undefined,
  });
}));

// Generate embedding
router.post('/embedding', asyncHandler(async (req: AuthRequest, res) => {
  const { text } = req.body;

  if (!text) {
    throw new AppError('Text is required', 400);
  }

  const ai = getAIClient();

  const response = await ai.models.embedContent({
    model: 'text-embedding-004',
    content: text,
  });

  res.json({
    embedding: response.embedding.values,
    dimension: response.embedding.values.length,
  });
}));

// Analyze image
router.post('/analyze-image', asyncHandler(async (req: AuthRequest, res) => {
  const { image, prompt } = req.body;

  if (!image || !prompt) {
    throw new AppError('Image and prompt are required', 400);
  }

  const ai = getAIClient();

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data: image, mimeType: 'image/jpeg' } },
      ],
    },
    config: {
      responseMimeType: 'application/json',
    },
  });

  res.json({
    text: response.text,
  });
}));

// Generate icebreaker messages
router.post('/icebreaker', asyncHandler(async (req: AuthRequest, res) => {
  const { myProfile, theirProfile } = req.body;

  if (!myProfile || !theirProfile) {
    throw new AppError('Both profiles are required', 400);
  }

  const ai = getAIClient();

  const prompt = `Generate 3 creative, personalized icebreaker messages for a dating app.

My profile:
- Name: ${myProfile.display_name}
- Bio: ${myProfile.bio || 'None'}
- Interests: ${myProfile.interests?.join(', ') || 'Not specified'}
- Intent: ${myProfile.intent?.join(', ') || 'Not specified'}

Their profile:
- Name: ${theirProfile.display_name}
- Bio: ${theirProfile.bio || 'None'}
- Interests: ${theirProfile.interests?.join(', ') || 'Not specified'}

Generate 3 unique icebreaker messages (numbered 1-3) that are:
1. Personalized based on shared interests or something unique in their profile
2. Conversational and open-ended
3. Not creepy or overly aggressive
4. Brief (under 100 characters each)

Return only the numbered messages, one per line.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: prompt,
  });

  const messages = response.text
    ?.split('\n')
    .filter((line: string) => line.trim())
    .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
    .slice(0, 3) || [];

  res.json({ messages });
}));

// Optimize bio
router.post('/optimize-bio', asyncHandler(async (req: AuthRequest, res) => {
  const { bio, intent, role, age } = req.body;

  if (!bio) {
    throw new AppError('Bio is required', 400);
  }

  const ai = getAIClient();

  const prompt = `Rewrite this dating app bio to be more engaging, attractive, and tailored to their intent.
Keep it under 300 characters.

Current Bio: ${bio}
Intent: ${intent || 'Not specified'}
Role: ${role || 'Not specified'}
Age: ${age || 'Not specified'}

Return only the improved bio, nothing else.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: prompt,
  });

  res.json({
    optimizedBio: response.text?.trim() || bio,
  });
}));

export default router;
