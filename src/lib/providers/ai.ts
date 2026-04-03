// AI Provider Interface
export interface AICompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AICompletionResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIEmbeddingResult {
  embedding: number[];
  dimension: number;
}

export interface IAIProvider {
  generateText(prompt: string, options?: AICompletionOptions): Promise<AICompletionResult>;
  generateChat(messages: Array<{role: string; content: string}>, options?: AICompletionOptions): Promise<AICompletionResult>;
  generateEmbedding(text: string): Promise<AIEmbeddingResult>;
  analyzeImage(imageBase64: string, prompt: string): Promise<AICompletionResult>;
}

// Google GenAI Implementation
export class AIProvider implements IAIProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
  }

  async generateText(prompt: string, options: AICompletionOptions = {}): Promise<AICompletionResult> {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        prompt,
        model: options.model || 'gemini-2.5-flash',
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 1000,
        systemPrompt: options.systemPrompt
      })
    });

    if (!response.ok) {
      throw new Error('Text generation failed');
    }

    return response.json();
  }

  async generateChat(messages: Array<{role: string; content: string}>, options: AICompletionOptions = {}): Promise<AICompletionResult> {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        messages,
        model: options.model || 'gemini-2.5-flash',
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 1000,
        systemPrompt: options.systemPrompt
      })
    });

    if (!response.ok) {
      throw new Error('Chat generation failed');
    }

    return response.json();
  }

  async generateEmbedding(text: string): Promise<AIEmbeddingResult> {
    const response = await fetch('/api/ai/embedding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error('Embedding generation failed');
    }

    return response.json();
  }

  async analyzeImage(imageBase64: string, prompt: string): Promise<AICompletionResult> {
    const response = await fetch('/api/ai/analyze-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        image: imageBase64,
        prompt
      })
    });

    if (!response.ok) {
      throw new Error('Image analysis failed');
    }

    return response.json();
  }
}

export const aiProvider = new AIProvider();
