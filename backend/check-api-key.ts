import { config } from 'dotenv';

// Load environment variables
config();

async function checkAPIKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is not set');
    process.exit(1);
  }

  console.log('Checking API key and available models...\n');
  console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

  // Try to list models using the REST API directly
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error details: ${errorText.substring(0, 500)}\n`);
      
      if (response.status === 401 || response.status === 403) {
        console.log('🔒 Authentication failed. Check if:');
        console.log('  1. Your API key is valid');
        console.log('  2. The Gemini API is enabled in your Google Cloud project');
        console.log('  3. Your API key has the correct permissions');
      }
      return;
    }

    const data = await response.json();
    const models = data.models || [];

    console.log(`✅ API key is valid! Found ${models.length} available models.\n`);
    
    // Filter for Gemini models
    const geminiModels = models
      .filter((m: any) => m.name?.includes('gemini'))
      .map((m: any) => ({
        name: m.name?.replace('models/', ''),
        displayName: m.displayName,
        supportedMethods: m.supportedGenerationMethods || [],
      }));

    if (geminiModels.length === 0) {
      console.log('⚠️  No Gemini models found. Your API key might not have access to Gemini models.');
      console.log('\nAvailable model types:', [...new Set(models.map((m: any) => m.name?.split('/')[0]))]);
    } else {
      console.log('Available Gemini models:\n');
      geminiModels.forEach((model: any) => {
        const supportsGenerateContent = model.supportedMethods.includes('generateContent');
        const status = supportsGenerateContent ? '✅' : '❌';
        console.log(`${status} ${model.name}`);
        if (model.displayName) console.log(`   Display: ${model.displayName}`);
        if (!supportsGenerateContent) console.log(`   ⚠️  Does not support generateContent`);
      });
      
      console.log('\n💡 Recommendation: Use one of the ✅ models above in your code.');
    }

  } catch (error: unknown) {
    console.error('❌ Error checking API:', error instanceof Error ? error.message : error);
  }
}

checkAPIKey().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

