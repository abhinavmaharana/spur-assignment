import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider } from './index';

const SYSTEM_PROMPT = `You are a helpful support agent for a small e-commerce store. Answer clearly and concisely.

FAQ Domain Knowledge:
- Shipping: We ship worldwide with delivery in 5–7 business days
- Returns: 30-day return & refund policy
- Support Hours: 9am–6pm IST, Monday–Saturday
- Free Shipping: Free shipping to USA on orders over $50

Keep responses helpful, professional, and concise.`;

const MAX_RESPONSE_TOKENS = 500;
const MAX_INPUT_TOKENS = 4000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // 1 second

export class GeminiProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.5-flash (latest, fastest, cost-effective) - Gemini 1.5 models are deprecated
    // Alternative: 'gemini-2.5-pro', 'gemini-2.0-flash', or 'gemini-2.0-flash-001'
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async generateReply(history: Array<{ sender: string; text: string }>, userMessage: string): Promise<string> {
    let lastError: Error | null = null;

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Build conversation context
        const conversationHistory = this.formatHistory(history);
        
        // Truncate history if too long
        const truncatedHistory = this.truncateHistory(conversationHistory);
        
        const prompt = `${SYSTEM_PROMPT}\n\nConversation History:\n${truncatedHistory}\n\nUser: ${userMessage}\n\nAssistant:`;

        // Add timeout to prevent hanging requests (30 seconds)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('LLM request timeout')), 30000);
        });

        const result = await Promise.race([
          this.model.generateContent(prompt, {
            generationConfig: {
              maxOutputTokens: MAX_RESPONSE_TOKENS,
              temperature: 0.7,
            },
          } as any),
          timeoutPromise,
        ]);

        const response = result.response;
        const text = response.text();

        if (!text || text.trim().length === 0) {
          return this.getFallbackMessage();
        }

        // Cap response length as a safety measure
        return text.trim().slice(0, 2000);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on certain errors
        if (
          errorMessage.includes('API_KEY') ||
          errorMessage.includes('401') ||
          errorMessage.includes('403') ||
          errorMessage.includes('400') ||
          errorMessage.includes('invalid')
        ) {
          console.error('Gemini API error (non-retryable):', errorMessage);
          return this.getFallbackMessage();
        }

        // Log retry attempt
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt); // Exponential backoff
          console.warn(`Gemini API error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms:`, errorMessage);
          await this.sleep(delay);
        } else {
          console.error('Gemini API error (max retries exceeded):', errorMessage);
        }
      }
    }

    // All retries failed
    return this.getFallbackMessage();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatHistory(history: Array<{ sender: string; text: string }>): string {
    return history
      .map((msg) => {
        const role = msg.sender === 'user' ? 'User' : 'Assistant';
        return `${role}: ${msg.text}`;
      })
      .join('\n');
  }

  private truncateHistory(history: string): string {
    // Simple token estimation: ~4 chars per token
    const estimatedTokens = history.length / 4;
    
    if (estimatedTokens <= MAX_INPUT_TOKENS) {
      return history;
    }

    // Truncate from the beginning, keep most recent messages
    const maxLength = MAX_INPUT_TOKENS * 4;
    return history.slice(-maxLength);
  }

  private getFallbackMessage(): string {
    return "Sorry — our support agent is having trouble right now. Please try again shortly.";
  }
}
