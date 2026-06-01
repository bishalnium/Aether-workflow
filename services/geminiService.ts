
// =============================================================
// Aether AI Service — Full BYOK (Bring Your Own Key) Support
// Supports: OpenAI, Anthropic, Google Gemini, Groq, OpenRouter
// =============================================================

// Default keys from env (free tier / app defaults)
const TAVILY_API_KEY = import.meta.env.VITE_TAVILY_API_KEY || '';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// Rotating Groq Keys
const GROQ_API_KEYS = [
  import.meta.env.VITE_GROQ_API_KEY_1 || '',
  import.meta.env.VITE_GROQ_API_KEY_2 || '',
  import.meta.env.VITE_GROQ_API_KEY_3 || ''
].filter(Boolean);

let currentFrontendKeyIndex = 0;
const frontendUsageStats: Record<string, number> = {};

async function callGroqWithRotationFrontend(
  messages: any[],
  temperature?: number
): Promise<string> {
  const keysCount = GROQ_API_KEYS.length;
  if (keysCount === 0) {
    throw new Error('No Groq API keys available for rotation in the frontend.');
  }

  let lastError: any = null;

  for (let attempt = 0; attempt < keysCount; attempt++) {
    const keyIndex = (currentFrontendKeyIndex + attempt) % keysCount;
    const apiKey = GROQ_API_KEYS[keyIndex];
    const maskedKey = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;

    try {
      frontendUsageStats[apiKey] = (frontendUsageStats[apiKey] || 0) + 1;
      console.log(`[Groq Frontend] Using Key #${keyIndex + 1} (${maskedKey}) - Attempt ${attempt + 1}/${keysCount} (Total frontend usage count: ${frontendUsageStats[apiKey]})`);

      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: 4096,
        }),
      });

      const data = await resp.json();
      if (data.error) {
        throw new Error(data.error.message || 'Groq API error');
      }

      currentFrontendKeyIndex = keyIndex;
      return data.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      console.warn(`[Groq Frontend] Key #${keyIndex + 1} failed on attempt ${attempt + 1}: ${error.message}`);
      lastError = error;
      
      // Roll over pre-emptively
      currentFrontendKeyIndex = (keyIndex + 1) % keysCount;
    }
  }

  throw new Error(`All frontend Groq API keys exhausted. Last error: ${lastError?.message}`);
}

// ---------------------------------------------------------------
// Extended signature: accepts BYOK fields
// ---------------------------------------------------------------
export const generateAgentResponse = async (
  prompt: string,
  systemInstruction: string,
  model?: string,
  imageUrl?: string,
  customApiKey?: string,
  apiProvider?: string,
  ioType?: string
): Promise<string> => {
  const actualModel = model || 'gpt-oss-120b';
  const effectiveIoType = ioType || 'text-to-text';

  console.log(
    `[AI Agent] provider="${apiProvider || 'default'}" model="${actualModel}" ioType="${effectiveIoType}" hasCustomKey=${!!customApiKey}`
  );

  try {
    // ===========================================================
    // TAVILY SEARCH — always uses env key regardless of BYOK
    // ===========================================================
    if (actualModel === 'tavily-search') {
      console.log(`[TAVILY] Searching: ${prompt.substring(0, 100)}...`);
      const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: TAVILY_API_KEY, query: prompt, max_results: 5, include_answer: true }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error || 'Tavily search failed');
      let out = '';
      if (data.answer) out += `**Summary:**\n${data.answer}\n\n`;
      if (data.results?.length) {
        out += `**Sources:**\n`;
        data.results.forEach((r: any, i: number) => {
          out += `\n${i + 1}. **${r.title}**\n   ${r.content?.substring(0, 200)}...\n   🔗 ${r.url}\n`;
        });
      }
      return out || 'No search results found.';
    }

    // ===========================================================
    // GROQ VISION — built-in vision (env key)
    // ===========================================================
    if (actualModel === 'groq-vision') {
      const hasImage = imageUrl || prompt.startsWith('data:image');
      if (hasImage) {
        console.log('[GROQ] Vision model with image...');
        const textPrompt = systemInstruction || prompt || 'Extract all text from this image.';
        const content: any[] = [{ type: 'text', text: textPrompt }];
        const imgSrc = imageUrl || prompt;
        content.push({ type: 'image_url', image_url: { url: imgSrc } });
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: GROQ_VISION_MODEL, messages: [{ role: 'user', content }], max_tokens: 4096 }),
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error.message || 'Groq vision failed');
        return data.choices?.[0]?.message?.content || 'No text extracted.';
      }
      // No image — fall through to default text generation below
    }

    // ===========================================================
    // BYOK ROUTING — user provided their own API key
    // ===========================================================
    if (customApiKey && apiProvider) {
      return await callWithCustomKey(prompt, systemInstruction, actualModel, imageUrl, customApiKey, apiProvider, effectiveIoType);
    }

    // ===========================================================
    // DEFAULT — Groq GPT-OSS-120B Reasoning AI with rotation
    // ===========================================================
    console.log('[GROQ] Using default GPT-OSS-120B reasoning model...');
    const messages: any[] = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    messages.push({ role: 'user', content: prompt });

    return await callGroqWithRotationFrontend(messages, 0.7);
  } catch (error: any) {
    console.error('[AI Service Error]', error);
    throw new Error(`AI Error: ${error.message}`);
  }
};


// ---------------------------------------------------------------
// callWithCustomKey — routes to the correct provider API
// ---------------------------------------------------------------
async function callWithCustomKey(
  prompt: string,
  systemInstruction: string,
  model: string,
  imageUrl: string | undefined,
  apiKey: string,
  provider: string,
  ioType: string
): Promise<string> {
  console.log(`[BYOK] Provider: ${provider}, Model: ${model}, ioType: ${ioType}`);

  switch (provider) {
    // -----------------------------------------------------------
    case 'openai':
      return callOpenAI(prompt, systemInstruction, model, imageUrl, apiKey, ioType);

    // -----------------------------------------------------------
    case 'anthropic':
      return callAnthropic(prompt, systemInstruction, model, apiKey);

    // -----------------------------------------------------------
    case 'google':
      return callGoogle(prompt, systemInstruction, model, apiKey);

    // -----------------------------------------------------------
    case 'groq':
      return callGroq(prompt, systemInstruction, model, imageUrl, apiKey, ioType);

    // -----------------------------------------------------------
    case 'openrouter':
      return callOpenRouter(prompt, systemInstruction, model, apiKey);

    // -----------------------------------------------------------
    default:
      throw new Error(`Unknown provider: ${provider}. Supported: openai, anthropic, google, groq, openrouter`);
  }
}

// ---------------------------------------------------------------
// OpenAI — handles text, image gen, TTS, Whisper
// ---------------------------------------------------------------
async function callOpenAI(
  prompt: string,
  systemInstruction: string,
  model: string,
  imageUrl: string | undefined,
  apiKey: string,
  ioType: string
): Promise<string> {
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const effectiveModel = model === 'custom-openai' ? 'gpt-4o' : model;

  // TEXT → IMAGE (DALL-E)
  if (ioType === 'text-to-image') {
    console.log('[OPENAI] DALL-E image generation...');
    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', response_format: 'url' }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'DALL-E error');
    const imageResultUrl = data.data?.[0]?.url;
    return imageResultUrl
      ? `**Generated Image:**\n![AI Generated Image](${imageResultUrl})\n\n🔗 [Open Image](${imageResultUrl})\n\n_Prompt: ${prompt}_`
      : 'Image generation failed — no URL returned.';
  }

  // TEXT → VOICE (TTS)
  if (ioType === 'text-to-voice') {
    console.log('[OPENAI] TTS audio generation...');
    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: 'tts-1', input: prompt, voice: 'alloy', response_format: 'mp3' }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || 'TTS error');
    }
    const audioBlob = await resp.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    return `**Audio Generated (TTS)**\n🔊 [Play Audio](${audioUrl})\n\n_Text: ${prompt.substring(0, 100)}..._\n\n> Audio blob URL created. Save quickly before navigating away.`;
  }

  // IMAGE → TEXT (GPT-4o Vision)
  if (ioType === 'image-to-text' && imageUrl) {
    console.log('[OPENAI] GPT-4o vision...');
    const content: any[] = [
      { type: 'text', text: systemInstruction || prompt || 'Describe this image in detail.' },
      { type: 'image_url', image_url: { url: imageUrl } },
    ];
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content }], max_tokens: 2048 }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'OpenAI vision error');
    return data.choices?.[0]?.message?.content || 'No description generated.';
  }

  // TEXT → TEXT (default)
  console.log(`[OPENAI] Chat completion with ${effectiveModel}...`);
  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: prompt });

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: effectiveModel, messages, max_tokens: 4096 }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message || 'OpenAI error');
  return data.choices?.[0]?.message?.content || 'No output generated.';
}

// ---------------------------------------------------------------
// Anthropic Claude
// ---------------------------------------------------------------
async function callAnthropic(
  prompt: string,
  systemInstruction: string,
  model: string,
  apiKey: string
): Promise<string> {
  const effectiveModel =
    model === 'custom-anthropic' ? 'claude-3-5-sonnet-20241022' :
    model === 'claude-3.5-sonnet' ? 'claude-3-5-sonnet-20241022' :
    model === 'claude-3-opus' ? 'claude-3-opus-20240229' :
    model === 'claude-3-haiku' ? 'claude-3-haiku-20240307' :
    model;

  console.log(`[ANTHROPIC] Calling ${effectiveModel}...`);
  const body: any = {
    model: effectiveModel,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  };
  if (systemInstruction) body.system = systemInstruction;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message || 'Anthropic error');
  if (data.type === 'error') throw new Error(data.error?.message || 'Anthropic API error');
  return data.content?.[0]?.text || 'No output generated.';
}

// ---------------------------------------------------------------
// Google Gemini
// ---------------------------------------------------------------
async function callGoogle(
  prompt: string,
  systemInstruction: string,
  model: string,
  apiKey: string
): Promise<string> {
  const effectiveModel =
    model === 'custom-google' ? 'gemini-2.0-flash' :
    model === 'gemini-2.5-flash' ? 'gemini-2.5-flash-preview-05-20' :
    model === 'gemini-1.5-pro' ? 'gemini-1.5-pro' :
    model === 'gemini-1.5-flash' ? 'gemini-1.5-flash' :
    'gemini-2.0-flash';

  console.log(`[GOOGLE] Calling ${effectiveModel}...`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;

  const contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }];
  const body: any = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message || 'Google Gemini error');
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No output generated.';
}

// ---------------------------------------------------------------
// Groq (Custom Key + Custom Model)
// ---------------------------------------------------------------
async function callGroq(
  prompt: string,
  systemInstruction: string,
  model: string,
  imageUrl: string | undefined,
  apiKey: string,
  ioType: string
): Promise<string> {
  const effectiveModel =
    model === 'custom-groq' ? 'meta-llama/llama-4-scout-17b-16e-instruct' :
    model;

  console.log(`[GROQ BYOK] Calling ${effectiveModel}...`);
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  // Vision
  if ((ioType === 'image-to-text') && imageUrl) {
    const content: any[] = [
      { type: 'text', text: systemInstruction || prompt || 'Describe this image.' },
      { type: 'image_url', image_url: { url: imageUrl } },
    ];
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: 'meta-llama/llama-4-scout-17b-16e-instruct', messages: [{ role: 'user', content }], max_tokens: 4096 }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'Groq vision error');
    return data.choices?.[0]?.message?.content || 'No output generated.';
  }

  // Text
  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: prompt });

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: effectiveModel, messages, max_tokens: 8192 }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message || 'Groq error');
  return data.choices?.[0]?.message?.content || 'No output generated.';
}

// ---------------------------------------------------------------
// OpenRouter with user's own key
// ---------------------------------------------------------------
async function callOpenRouter(
  prompt: string,
  systemInstruction: string,
  model: string,
  apiKey: string
): Promise<string> {
  const effectiveModel =
    model === 'gpt-4o' ? 'openai/gpt-4o' :
    model === 'gpt-4o-mini' ? 'openai/gpt-4o-mini' :
    model === 'claude-3.5-sonnet' ? 'anthropic/claude-3.5-sonnet' :
    model === 'claude-3-opus' ? 'anthropic/claude-3-opus' :
    model === 'gemini-2.5-flash' ? 'google/gemini-2.5-flash-preview-05-20' :
    model;

  console.log(`[OPENROUTER BYOK] Calling ${effectiveModel}...`);
  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: prompt });

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: effectiveModel, messages }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message || 'OpenRouter error');
  return data.choices?.[0]?.message?.content || 'No output generated.';
}
