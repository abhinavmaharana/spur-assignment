import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

async function checkAvailableModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is not set');
    process.exit(1);
  }

  console.log('Checking available models for your API key...\n');
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Try to list available models (if the SDK supports it)
  // Otherwise, we'll test specific model names
  const modelsToTest = [
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro-001',
    'gemini-1.5-flash-001',
  ];

  console.log('Testing model availability:\n');

  for (const modelName of modelsToTest) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      // Try a simple generateContent call
      const result = await Promise.race([
        model.generateContent('test'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);
      
      console.log(`✅ ${modelName} - Available and working!`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        console.log(`❌ ${modelName} - Not available (404)`);
      } else if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('API_KEY')) {
        console.log(`🔒 ${modelName} - Authentication error (check API key)`);
      } else if (errorMsg.includes('Timeout')) {
        console.log(`⏱️  ${modelName} - Timeout (model might be available but slow)`);
      } else {
        console.log(`⚠️  ${modelName} - Error: ${errorMsg.substring(0, 100)}`);
      }
    }
  }

  console.log('\n✅ = Available\n❌ = Not found\n🔒 = Authentication issue\n');
}

checkAvailableModels().catch((error) => {
  console.error('Error checking models:', error);
  process.exit(1);
});

