import axios from 'axios';
import { logger } from './logger';

const GROQ_API_KEYS = [
  process.env.GROQ_API_KEY_1 || '',
  process.env.GROQ_API_KEY_2 || '',
  process.env.GROQ_API_KEY_3 || ''
].filter(Boolean);

let currentKeyIndex = 0;
const usageStats: Record<string, number> = {};

/**
 * Get the next API key using rotation. Shared between chat and vision.
 */
function getNextKey(attempt: number): { apiKey: string; keyIndex: number; maskedKey: string } {
  const keysCount = GROQ_API_KEYS.length;
  const keyIndex = (currentKeyIndex + attempt) % keysCount;
  const apiKey = GROQ_API_KEYS[keyIndex];
  const maskedKey = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
  return { apiKey, keyIndex, maskedKey };
}

/**
 * Text chat completion with 3-key rotation
 */
export async function groqChat(options: {
  messages: any[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const keysCount = GROQ_API_KEYS.length;
  if (keysCount === 0) {
    throw new Error('No Groq API keys configured in environment.');
  }

  let lastError: any = null;

  for (let attempt = 0; attempt < keysCount; attempt++) {
    const { apiKey, keyIndex, maskedKey } = getNextKey(attempt);

    try {
      usageStats[apiKey] = (usageStats[apiKey] || 0) + 1;
      logger.info(`[Groq API] Using Key #${keyIndex + 1} (${maskedKey}) - Attempt ${attempt + 1}/${keysCount} (Total key usage count: ${usageStats[apiKey]})`);

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: options.model || 'openai/gpt-oss-120b',
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 4096,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );

      // Successfully ran. Keep the pointer at this key index so subsequent requests start here
      currentKeyIndex = keyIndex;
      return response.data.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      logger.warn(`[Groq API] Key #${keyIndex + 1} failed on attempt ${attempt + 1}: ${error.response?.status || error.message}`);
      lastError = error;
      
      // Roll over to the next key index pre-emptively for the next attempt
      currentKeyIndex = (keyIndex + 1) % keysCount;
    }
  }

  throw new Error(`All Groq API keys exhausted. Last error: ${lastError?.response?.data?.error?.message || lastError?.message}`);
}

/**
 * Vision chat completion with 3-key rotation (for Llama 4 Scout vision model)
 */
export async function groqVisionChat(options: {
  messages: any[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const keysCount = GROQ_API_KEYS.length;
  if (keysCount === 0) {
    throw new Error('No Groq API keys configured in environment.');
  }

  let lastError: any = null;

  for (let attempt = 0; attempt < keysCount; attempt++) {
    const { apiKey, keyIndex, maskedKey } = getNextKey(attempt);

    try {
      usageStats[apiKey] = (usageStats[apiKey] || 0) + 1;
      logger.info(`[Groq Vision] Using Key #${keyIndex + 1} (${maskedKey}) - Attempt ${attempt + 1}/${keysCount}`);

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: options.model || 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: options.messages,
          temperature: options.temperature ?? 1,
          max_tokens: options.maxTokens ?? 1024,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );

      currentKeyIndex = keyIndex;
      return response.data.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      logger.warn(`[Groq Vision] Key #${keyIndex + 1} failed on attempt ${attempt + 1}: ${error.response?.status || error.message}`);
      lastError = error;
      currentKeyIndex = (keyIndex + 1) % keysCount;
    }
  }

  throw new Error(`All Groq API keys exhausted (vision). Last error: ${lastError?.response?.data?.error?.message || lastError?.message}`);
}

