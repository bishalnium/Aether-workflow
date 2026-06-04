import axios from 'axios';
import { logger } from './logger';
import { groqChat } from './groqClient';

export interface LLMRequestOptions {
  messages: any[];
  systemPrompt?: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callDynamicLLM(options: LLMRequestOptions): Promise<string> {
  const provider = options.provider || 'groq';
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 4096;
  const systemPrompt = options.systemPrompt || '';

  // Prepare messages with system prompt if not already present
  const messages = [...options.messages];
  
  // Clean model names
  let model = options.model || '';

  logger.info(`[LLM Router] Routing request to: provider="${provider}", model="${model}"`);

  // Fallback API Key determination
  let apiKey = options.apiKey || '';
  if (!apiKey) {
    if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY || '';
    else if (provider === 'anthropic') apiKey = process.env.ANTHROPIC_API_KEY || '';
    else if (provider === 'google') apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
    else if (provider === 'openrouter') apiKey = process.env.OPENROUTER_API_KEY || '';
    else if (provider === 'groq') apiKey = process.env.GROQ_API_KEY || '';
  }

  const maxAttempts = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // If groq is selected but no custom/env API key is present, fallback to rotating key pool
      if (provider === 'groq' && !apiKey) {
        logger.info(`[LLM Router] Groq selected without explicit API key. Falling back to rotating key pool (attempt ${attempt}/${maxAttempts}).`);
        // Construct system instructions
        const systemInstruction = systemPrompt || (messages.find(m => m.role === 'system')?.content);
        const userMessages = messages.filter(m => m.role !== 'system');
        return await groqChat({
          messages: userMessages,
          model: model || 'openai/gpt-oss-120b',
          temperature,
          maxTokens
        });
      }

      if (provider !== 'groq' && !apiKey) {
        throw new Error(`API key for provider "${provider}" is not configured. Add it to the node configuration or backend .env.`);
      }

      switch (provider) {
        case 'openai': {
          const effectiveModel = model === 'custom-openai' ? 'gpt-4o' : (model || 'gpt-4o-mini');
          
          // Inject system prompt into messages if specified
          if (systemPrompt && !messages.some(m => m.role === 'system')) {
            messages.unshift({ role: 'system', content: systemPrompt });
          }

          const resp = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: effectiveModel,
              messages,
              temperature,
              max_tokens: maxTokens,
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              timeout: 30000,
            }
          );
          return resp.data.choices?.[0]?.message?.content || '';
        }

        case 'anthropic': {
          const effectiveModel =
            model === 'custom-anthropic' ? 'claude-3-5-sonnet-20241022' :
            model === 'claude-3.5-sonnet' ? 'claude-3-5-sonnet-20241022' :
            model === 'claude-3-opus' ? 'claude-3-opus-20240229' :
            model === 'claude-3-haiku' ? 'claude-3-haiku-20240307' :
            (model || 'claude-3-5-haiku-20241022');

          // Extract system instruction for Claude
          let sys = systemPrompt;
          const systemMsgIndex = messages.findIndex(m => m.role === 'system');
          if (systemMsgIndex !== -1) {
            sys = messages[systemMsgIndex].content;
            messages.splice(systemMsgIndex, 1);
          }

          // Map roles to Anthropic (must be user/assistant only)
          const anthropicMessages = messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          }));

          const body: any = {
            model: effectiveModel,
            max_tokens: maxTokens,
            messages: anthropicMessages,
            temperature,
          };
          if (sys) body.system = sys;

          const resp = await axios.post(
            'https://api.anthropic.com/v1/messages',
            body,
            {
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              timeout: 30000,
            }
          );
          return resp.data.content?.[0]?.text || '';
        }

        case 'google': {
          const effectiveModel =
            model === 'custom-google' ? 'gemini-2.0-flash' :
            model === 'gemini-3.5-flash' ? 'gemini-2.5-flash' : // Fallback mappings for known models
            model === 'gemini-2.5-flash' ? 'gemini-2.5-flash' :
            model === 'gemini-3.5-pro' ? 'gemini-2.5-pro' :
            model === 'gemini-2.5-pro' ? 'gemini-2.5-pro' :
            (model || 'gemini-2.5-flash');

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;

          // Map messages to Gemini format
          const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            }));

          // Get system prompt
          let sys = systemPrompt;
          const systemMsg = messages.find(m => m.role === 'system');
          if (systemMsg) sys = systemMsg.content;

          const body: any = { contents };
          if (sys) {
            body.systemInstruction = { parts: [{ text: sys }] };
          }

          const resp = await axios.post(url, body, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
          });
          return resp.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        case 'groq': {
          const effectiveModel = model === 'custom-groq' ? 'meta-llama/llama-4-scout-17b-16e-instruct' : (model || 'meta-llama/llama-4-scout-17b-16e-instruct');
          
          if (systemPrompt && !messages.some(m => m.role === 'system')) {
            messages.unshift({ role: 'system', content: systemPrompt });
          }

          const resp = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              model: effectiveModel,
              messages,
              temperature,
              max_tokens: maxTokens,
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              timeout: 30000,
            }
          );
          return resp.data.choices?.[0]?.message?.content || '';
        }

        case 'openrouter': {
          const effectiveModel =
            model === 'gpt-4o' ? 'openai/gpt-4o' :
            model === 'gpt-4o-mini' ? 'openai/gpt-4o-mini' :
            model === 'claude-3.5-sonnet' ? 'anthropic/claude-3.5-sonnet' :
            model === 'claude-3-opus' ? 'anthropic/claude-3-opus' :
            model || 'meta-llama/llama-3.1-8b-instruct';

          if (systemPrompt && !messages.some(m => m.role === 'system')) {
            messages.unshift({ role: 'system', content: systemPrompt });
          }

          const resp = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              model: effectiveModel,
              messages,
              temperature,
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              timeout: 30000,
            }
          );
          return resp.data.choices?.[0]?.message?.content || '';
        }

        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err.response?.data?.error?.message || err.message;
      logger.warn(`[LLM Router] Call failed for provider "${provider}" (attempt ${attempt}/${maxAttempts}): ${errMsg}`);
      if (attempt < maxAttempts) {
        const delay = 1000 * attempt;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const errMsg = lastError.response?.data?.error?.message || lastError.message;
  logger.error(`[LLM Router] Call permanently failed for provider "${provider}": ${errMsg}`);
  throw new Error(`LLM Error (${provider}) after ${maxAttempts} attempts: ${errMsg}`);
}
