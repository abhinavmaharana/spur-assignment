import { GeminiProvider } from './gemini';

export interface LLMProvider {
  generateReply(
    history: Array<{ sender: string; text: string }>,
    userMessage: string
  ): Promise<string>;
}

export function createLLMProvider(): LLMProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  return new GeminiProvider(apiKey);
}
