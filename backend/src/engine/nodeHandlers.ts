// ===========================================
// AETHER WORKFLOW ENGINE - Node Handler Registry
// All node type handlers
// ===========================================

import { WorkflowNode, ExecutionContext, NodeHandler, NodeType } from '../types/workflow.types';
import axios from 'axios';
import nodemailer from 'nodemailer';

// Simple console logger to avoid circular dependencies
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  debug: (msg: string, meta?: any) => console.log(`[DEBUG] ${msg}`, meta || ''),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || ''),
  error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta || ''),
};

// Inline credential service (simplified for node handlers)
const credentialStore = new Map<string, any>();
const credentialService = {
  async getDecrypted(credentialId: string, userId: string): Promise<Record<string, any> | null> {
    return credentialStore.get(credentialId) || null;
  }
};

import { groqChat, groqVisionChat } from '../utils/groqClient';
import { callDynamicLLM } from '../utils/llmClient';

// Dynamic base URL for internal API calls - uses Render URL in production
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || 'http://localhost:8080';

// Inline AI service for node handlers using Groq GPT-OSS-120B with rotation
const aiService = {
  async chat(options: { prompt: string; systemPrompt?: string; model?: string; temperature?: number }): Promise<string> {
    try {
      const messages: any[] = [];
      
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      
      messages.push({ role: 'user', content: options.prompt });

      return await groqChat({
        messages,
        temperature: options.temperature ?? 0.7
      });
    } catch (error: any) {
      logger.error('AI service error:', error.message);
      return `AI Error: ${error.message}`;
    }
  }
};

class NodeHandlerRegistry {
  private handlers: Map<NodeType | string, NodeHandler> = new Map();

  register(type: NodeType | string, handler: NodeHandler): void {
    this.handlers.set(type, handler);
  }

  getHandler(type: NodeType | string): NodeHandler | undefined {
    return this.handlers.get(type);
  }

  listHandlers(): string[] {
    return Array.from(this.handlers.keys()) as string[];
  }
}

export const nodeHandlerRegistry = new NodeHandlerRegistry();

// ===========================================
// FRONTEND COMPATIBILITY - AGENT NODE
// ===========================================

// Only 3 models supported:
// 1. gpt-oss-120b (GPT-OSS 120B) - Text AI via Groq
// 2. tavily-search - Web search via Tavily API
// 3. groq-vision - Image/OCR via Groq API (Llama 4 Scout)

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
// GROQ_API_KEY removed — all Groq calls now use groqChat/groqVisionChat with 3-key rotation

// AGENT node handler - routes to appropriate API based on model
nodeHandlerRegistry.register('AGENT', async (node, input, context) => {
  // Debug: log the entire node structure to find where model is stored
  logger.info(`[AGENT] Node structure:`, { 
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    configKeys: node.config ? Object.keys(node.config) : 'no config',
    configModel: node.config?.model,
    configSystemPrompt: node.config?.systemPrompt?.substring(0, 50)
  });
  
  const { model = 'gpt-oss-120b', systemPrompt } = node.config || {};
  
  // Get user input from webhook body or previous node
  const userMessage = input?.body?.message || input?.body?.question || input?.body?.input || 
                      input?.message || input?.question || input?.input || 
                      (typeof input?.body === 'string' ? input.body : null) ||
                      (typeof input === 'string' ? input : JSON.stringify(input));
  
  logger.info(`[AGENT] Executing with model: ${model}`, { 
    nodeId: node.id, 
    systemPrompt: systemPrompt?.substring(0, 100),
    userMessage: userMessage?.substring(0, 100)
  });
  
  try {
    let mappedInput = userMessage;
    if (node.config?.llmAutoMap) {
      logger.info(`[AGENT-MAPPING] Running LLM Auto-Mapping for integration model: ${model}`);
      try {
        const mapSystemPrompt = node.config.llmAutoMapPrompt || 'You are a data mapping assistant. Output the exact structure or format required.';
        const mapProvider = node.config.llmAutoMapProvider || 'groq';
        const mapModel = node.config.llmAutoMapModel || '';
        const mapApiKey = node.config.llmAutoMapApiKey || '';
        
        mappedInput = await callDynamicLLM({
          messages: [
            { role: 'user', content: userMessage || 'No input context' }
          ],
          systemPrompt: mapSystemPrompt,
          provider: mapProvider,
          model: mapModel,
          apiKey: mapApiKey,
          temperature: 0.3
        });
        logger.info(`[AGENT-MAPPING] Auto-Mapping result: ${mappedInput.substring(0, 100)}...`);
      } catch (llmMapErr: any) {
        logger.warn(`[AGENT-MAPPING] LLM Auto-Mapping failed: ${llmMapErr.message}. Proceeding with raw message.`);
      }
    }

    // Intercept integration models
    if (model === 'google-sheets') {
      logger.info(`[AGENT-SHEETS] Executing Sheets action: ${node.config.integrationAction}`);
      const resp = await axios.post(`${SELF_URL}/api/v1/integrations/sheets/execute`, {
        action: node.config.integrationAction || 'read-sheet',
        sheetsId: node.config.sheetsId,
        range: node.config.sheetsRange || 'Sheet1!A1:Z100',
        rowData: node.config.llmAutoMap ? mappedInput : (userMessage || '[]'),
        serviceAccountJson: node.config.sheetsServiceAccountJson
      }, {
        headers: { 'Authorization': 'Bearer demo-token', 'Content-Type': 'application/json' }
      });
      const dataStr = JSON.stringify(resp.data?.data || resp.data, null, 2);
      return {
        ...input,
        response: dataStr,
        output: dataStr,
        data: resp.data?.data || resp.data,
        success: resp.data?.success !== false
      };
    }

    if (model === 'telegram-bot') {
      logger.info(`[AGENT-TELEGRAM] Executing Telegram action: ${node.config.integrationAction}`);
      const resp = await axios.post(`${SELF_URL}/api/v1/integrations/telegram/execute`, {
        token: node.config.integrationToken,
        action: node.config.integrationAction || 'send-message',
        chatId: node.config.chatId || '',
        message: node.config.llmAutoMap ? mappedInput : (node.config.messageText || userMessage || 'Hello from Aether!'),
        photoUrl: node.config.photoUrl || ''
      }, {
        headers: { 'Authorization': 'Bearer demo-token', 'Content-Type': 'application/json' }
      });
      const dataStr = JSON.stringify(resp.data?.data || resp.data, null, 2);
      return {
        ...input,
        response: dataStr,
        output: dataStr,
        data: resp.data?.data || resp.data,
        success: resp.data?.success !== false
      };
    }

    if (model === 'notion') {
      logger.info(`[AGENT-NOTION] Executing Notion action: ${node.config.integrationAction}`);
      const resp = await axios.post(`${SELF_URL}/api/v1/integrations/notion/execute`, {
        token: node.config.integrationToken,
        action: node.config.integrationAction || 'query-database',
        databaseId: node.config.notionDbId || '',
        properties: node.config.llmAutoMap ? mappedInput : (node.config.notionProperties || ''),
        query: node.config.llmAutoMap ? mappedInput : (node.config.notionQuery || userMessage || '')
      }, {
        headers: { 'Authorization': 'Bearer demo-token', 'Content-Type': 'application/json' }
      });
      const dataStr = JSON.stringify(resp.data?.data || resp.data, null, 2);
      return {
        ...input,
        response: dataStr,
        output: dataStr,
        data: resp.data?.data || resp.data,
        success: resp.data?.success !== false
      };
    }

    if (model === 'discord') {
      logger.info(`[AGENT-DISCORD] Executing Discord send message`);
      const resp = await axios.post(`${SELF_URL}/api/v1/integrations/discord/send`, {
        webhookUrl: node.config.discordWebhookUrl,
        message: node.config.llmAutoMap ? mappedInput : (node.config.discordMessage || userMessage || 'Hello from Aether Workflow!'),
        action: node.config.integrationAction || 'send-message'
      }, {
        headers: { 'Authorization': 'Bearer demo-token', 'Content-Type': 'application/json' }
      });
      const dataStr = JSON.stringify(resp.data?.data || resp.data, null, 2);
      return {
        ...input,
        response: dataStr,
        output: dataStr,
        data: resp.data?.data || resp.data,
        success: resp.data?.success !== false
      };
    }

    if (model === 'github-api') {
      logger.info(`[AGENT-GITHUB] Executing GitHub action: ${node.config.integrationAction}`);
      
      const token = node.config.integrationToken;
      if (!token) throw new Error('GitHub PAT not configured. Add your Personal Access Token in the config panel.');
      const action = node.config.integrationAction || 'list-repos';
      let apiUrl = 'https://api.github.com/user/repos?sort=updated&per_page=10';
      let method = 'GET';
      let requestBody = undefined;
      
      if (action === 'list-repos') {
          apiUrl = 'https://api.github.com/user/repos?sort=updated&per_page=10';
      } else if (action === 'list-issues') {
          const repo = node.config.githubRepo || '';
          apiUrl = `https://api.github.com/repos/${repo}/issues?state=open&per_page=10`;
      } else if (action === 'create-issue') {
          const repo = node.config.githubRepo || '';
          apiUrl = `https://api.github.com/repos/${repo}/issues`;
          method = 'POST';
          
          let issueTitle = userMessage || 'New Issue';
          let issueBody = node.config.githubIssueBody || '';
          if (node.config.llmAutoMap) {
              try {
                  const parsed = JSON.parse(mappedInput);
                  issueTitle = parsed.title || issueTitle;
                  issueBody = parsed.body || issueBody;
              } catch (e) {
                  issueBody = mappedInput;
              }
          }
          requestBody = { title: issueTitle, body: issueBody };
      } else if (action === 'get-file') {
          const repo = node.config.githubRepo || '';
          const path = node.config.githubFilePath || 'README.md';
          apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
      }
      
      const ghResp = await axios({
        url: apiUrl,
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'Aether-Workflow' },
        data: requestBody
      });
      
      let finalOutput;
      if (action === 'list-repos') {
          finalOutput = ghResp.data.map((r: any) => `${r.full_name} ⭐` + r.stargazers_count + ` (` + (r.language || 'N/A') + `)`).join('\n');
      } else if (action === 'get-file' && ghResp.data.content) {
          finalOutput = Buffer.from(ghResp.data.content, 'base64').toString('utf8');
      } else {
          finalOutput = JSON.stringify(ghResp.data, null, 2).substring(0, 2000);
      }
      
      return {
        ...input,
        response: finalOutput,
        output: finalOutput,
        data: ghResp.data,
        success: true
      };
    }

    if (model === 'firebase') {
      logger.info(`[AGENT-FIREBASE] Executing Firebase action: ${node.config.integrationAction}`);
      const resp = await axios.post(`${SELF_URL}/api/v1/integrations/firebase/execute`, {
        action: node.config.integrationAction || 'read-doc',
        serviceAccountJson: node.config.firebaseServiceAccountJson,
        documentPath: node.config.firebaseDocPath || '',
        collectionPath: node.config.firebaseCollectionPath || '',
        data: node.config.llmAutoMap ? mappedInput : (node.config.firebaseData || userMessage || '{}'),
        query: node.config.firebaseQuery || ''
      }, {
        headers: { 'Authorization': 'Bearer demo-token', 'Content-Type': 'application/json' }
      });
      const dataStr = JSON.stringify(resp.data?.data || resp.data, null, 2);
      return {
        ...input,
        response: dataStr,
        output: dataStr,
        data: resp.data?.data || resp.data,
        success: resp.data?.success !== false
      };
    }

    if (model === 'db-read' || model === 'db-write') {
      logger.info(`[AGENT-DATABASE] Executing Database action`);
      const isRead = model === 'db-read';
      const resp = await axios.post(`${SELF_URL}/api/v1/database/execute`, {
        operation: isRead ? 'select' : (node.config.dbOperation || 'insert'),
        table: node.config.tableName || '',
        filter: node.config.dbFilter,
        limit: node.config.dbLimit,
        data: isRead ? undefined : (node.config.llmAutoMap ? mappedInput : userMessage),
        dbType: node.config.dbType || 'sqlite',
        connectionString: node.config.connectionString || '',
      }, {
        headers: { 'Authorization': 'Bearer demo-token', 'Content-Type': 'application/json' }
      });
      const dataStr = JSON.stringify(resp.data?.data || resp.data, null, 2);
      return {
        ...input,
        response: dataStr,
        output: dataStr,
        data: resp.data?.data || resp.data,
        success: resp.data?.success !== false
      };
    }

    let aiResponse: string;
    
    // Route to appropriate API based on model
    if (model === 'mock-sender') {
      // EMAIL SENDER - Use Resend API
      const emailTo = input?.body?.email || input?.email || node.config?.to || 'bishalpvtxd@gmail.com';
      const emailSubject = node.config?.subject || input?.subject || 'Workflow Notification';
      let emailBody = input?.response || input?.aiResponse || input?.output || input?.body?.response || 
                        (typeof input === 'string' ? input : JSON.stringify(input, null, 2));
      
      // Use LLM to format email body nicely if formatWithAI is enabled (default true)
      if (node.config?.formatWithAI !== false && emailBody && emailBody.trim() !== '') {
        try {
          logger.info(`[MOCK-SENDER] Formatting email body with LLM...`);
          const formattedBody = await groqChat({
            messages: [
              { 
                role: 'system', 
                content: `You are an email formatting assistant. Your job is to take raw inputs (which may be JSON, markdown, or search results) and format them into a highly professional, clean, and properly formatted plain text email message.
Do not include JSON characters, brackets, or code blocks in your final output unless explicitly requested. Output only the clean body of the email.` 
              },
              { role: 'user', content: emailBody }
            ],
            temperature: 0.3,
            maxTokens: 2000
          });
          if (formattedBody && formattedBody.trim() !== '') {
            emailBody = formattedBody.trim();
            logger.info(`[MOCK-SENDER] LLM email formatting completed successfully`);
          }
        } catch (llmErr: any) {
          logger.warn(`[MOCK-SENDER] LLM email formatting failed, sending raw: ${llmErr.message}`);
        }
      }

      logger.info(`[MOCK-SENDER] Sending email via Resend`, { to: emailTo, subject: emailSubject });
      
      try {
        const emailResponse = await axios.post(
          'https://api.resend.com/emails',
          {
            from: 'onboarding@resend.dev',
            to: emailTo,
            subject: emailSubject,
            html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #667eea;">🚀 Aether Workflow Result</h2>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; white-space: pre-wrap;">
                       ${emailBody}
                    </div>
                    <p style="color: #888; margin-top: 20px; font-size: 12px;">Sent by Aether Orchestrate</p>
                   </div>`
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY || 're_FXGhVrqm_KgBsJSZdmyo1kSHvbxQM6eMn'}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        logger.info(`[MOCK-SENDER] Email sent successfully`, { id: emailResponse.data?.id });
        aiResponse = `✅ Email sent successfully to ${emailTo}`;
      } catch (emailError: any) {
        logger.error(`[MOCK-SENDER] Email failed:`, emailError.response?.data || emailError.message);
        aiResponse = `❌ Email failed: ${emailError.response?.data?.message || emailError.message}`;
      }
      
    } else if (model === 'tavily-search') {
      // TAVILY WEB SEARCH
      const response = await axios.post(
        'https://api.tavily.com/search',
        {
          api_key: TAVILY_API_KEY,
          query: userMessage,
          max_results: 5,
          include_answer: true
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      const data = response.data;
      let formattedResponse = '';
      if (data.answer) {
        formattedResponse += `**Summary:**\n${data.answer}\n\n`;
      }
      if (data.results?.length > 0) {
        formattedResponse += `**Sources:**\n`;
        data.results.forEach((result: any, index: number) => {
          formattedResponse += `\n${index + 1}. **${result.title}**\n   ${result.content?.substring(0, 200)}...\n   🔗 ${result.url}\n`;
        });
      }
      aiResponse = formattedResponse || 'No search results found.';
      
    } else if (model === 'groq-vision') {
      // GROQ VISION (for images) — uses 3-key rotation
      const messageContent: any[] = [
        { type: 'text', text: systemPrompt || 'Extract all text from this image.' }
      ];
      
      // Check if input contains image
      const imageUrl = input?.imageUrl || input?.body?.imageUrl;
      if (imageUrl) {
        messageContent.push({ type: 'image_url', image_url: { url: imageUrl } });
      }
      
      aiResponse = await groqVisionChat({
        messages: [{ role: 'user', content: messageContent }],
        maxTokens: 4096
      }) || 'No text extracted.';
      
    } else if (model === 'ddg-search') {
      // DUCKDUCKGO LLM SEARCH AGENT LOOP (RAG-POWERED)
      logger.info(`[DDG-SEARCH-RAG] Initiating RAG Agent Loop for: "${userMessage}"`);

      const {
        systemPrompt,
        llmProvider,
        llmModel,
        llmApiKey,
        llmTemperature
      } = node.config || {};

      const llmOptions = {
        provider: llmProvider || 'groq',
        model: llmModel,
        apiKey: llmApiKey,
        temperature: llmTemperature !== undefined ? llmTemperature : 0.3
      };
      
      let attempts = 0;
      const maxAttempts = 2;
      let allSearchResults: string[] = [];
      let lastQuery = userMessage;
      let isResolved = false;
      let justification = '';
      let finalAnswer = '';
      
      while (attempts < maxAttempts && !isResolved) {
        attempts++;
        logger.info(`[DDG-SEARCH-RAG] Attempt ${attempts}/${maxAttempts}`);
        
        // Step 1: Formulate search query using LLM
        let searchQuery = userMessage;
        if (attempts === 1) {
          try {
            const queryResponse = await callDynamicLLM({
              messages: [
                { 
                  role: 'system', 
                  content: `You are a search query optimizer for the DuckDuckGo Instant Answers API. The API only returns results for Wikipedia-style topic titles or general concepts (e.g., "React (software)", "Retrieval-augmented generation", "Joe Biden"), NOT conversational questions.
Given the user's question, generate the BEST concise topic name, keyword, or Wikipedia-style title to fetch the information.
CRITICAL: DO NOT include conversational prefixes such as "what is", "who is", "how to", "why does", "define", "explain", "meaning of", "about", etc. Output ONLY the core entity, noun phrase, or concept name. Return ONLY the raw query string, no quotes, no explanation.` 
                },
                { role: 'user', content: userMessage }
              ],
              ...llmOptions,
              temperature: 0.3
            });
            searchQuery = queryResponse.trim().replace(/^["']|["']$/g, '') || userMessage;
          } catch (aiErr: any) {
            logger.warn(`[DDG-SEARCH-RAG] Attempt 1 query optimization failed: ${aiErr.message}`);
            searchQuery = userMessage;
          }
        } else {
          // For attempt > 1, ask the LLM to refine the query based on what we already found
          try {
            const contextText = allSearchResults.join('\n\n');
            const refinementResponse = await callDynamicLLM({
              messages: [
                { 
                  role: 'system', 
                  content: `You are a search query refiner for the DuckDuckGo Instant Answers API. The API only returns results for Wikipedia-style topic titles or general concepts, NOT conversational questions. We previously searched for "${lastQuery}" and found insufficient information.
Based on the user's original question and the current findings, generate a NEW keyword, topic name, or Wikipedia-style title to retrieve the missing details.
CRITICAL: DO NOT include conversational prefixes such as "what is", "who is", "how to", "why does", "define", "explain", "meaning of", "about", etc. Output ONLY the core entity, noun phrase, or concept name. Return ONLY the raw query string, no quotes, no explanation.` 
                },
                { role: 'user', content: `Original Question: ${userMessage}\n\nPrevious Findings:\n${contextText.substring(0, 2000)}` }
              ],
              ...llmOptions,
              temperature: 0.3
            });
            searchQuery = refinementResponse.trim().replace(/^["']|["']$/g, '') || userMessage;
          } catch (aiErr: any) {
            logger.warn(`[DDG-SEARCH-RAG] Attempt ${attempts} query refinement failed: ${aiErr.message}`);
            searchQuery = userMessage;
          }
        }
        
        lastQuery = searchQuery;
        logger.info(`[DDG-SEARCH-RAG] Running search for query: "${searchQuery}"`);
        
        // Step 2: Fetch search results
        let searchData: any = {};
        try {
          const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1`;
          const response = await axios.get(url, { timeout: 8000 });
          searchData = response.data;
        } catch (searchErr: any) {
          logger.error(`[DDG-SEARCH-RAG] Search request failed: ${searchErr.message}`);
        }
        
        // Accumulate findings
        const currentResults: string[] = [];
        if (searchData.Abstract) currentResults.push(`[Abstract from ${searchData.AbstractSource || 'web'}]: ${searchData.Abstract}`);
        if (searchData.Answer) currentResults.push(`[Direct Answer]: ${searchData.Answer}`);
        if (searchData.Definition) currentResults.push(`[Definition]: ${searchData.Definition}`);
        if (searchData.Heading) currentResults.push(`[Heading]: ${searchData.Heading}`);
        (searchData.RelatedTopics || []).slice(0, 10).forEach((t: any) => {
          if (t.Text) currentResults.push(`[Related Topic]: ${t.Text} (${t.FirstURL || ''})`);
        });
        
        if (currentResults.length > 0) {
          allSearchResults.push(...currentResults);
        } else {
          allSearchResults.push(`No direct answers or abstracts found for query: "${searchQuery}"`);
        }
        
        // Step 3: LLM evaluates results and decides to pass forward or not
        logger.info(`[DDG-SEARCH-RAG] Evaluating results with LLM...`);
        const contextBlock = allSearchResults.join('\n\n');
        
        try {
          let finalSystemPrompt = systemPrompt || `You are an AI research validator. You are evaluating if the search results contain sufficient information to answer the user's question.`;
          finalSystemPrompt += `\n\nYou must output a JSON object with the following fields:
{
  "isResolved": boolean, // Set to true if the search results are sufficient to answer the user's question. Set to false if key facts are still missing.
  "justification": "Brief explanation of why the search results are or are not sufficient.",
  "searchQuerySuggestion": "If isResolved is false, suggest a better search query to find the missing details. Otherwise, leave empty.",
  "compiledAnswer": "If isResolved is true, provide the final comprehensive answer to the user. Otherwise, provide a draft of what you know so far."
}
IMPORTANT: Output ONLY the valid JSON block, nothing else.`;

          const evaluationResponse = await callDynamicLLM({
            messages: [
              { 
                role: 'system', 
                content: finalSystemPrompt
              },
              { 
                role: 'user', 
                content: `User's Question: ${userMessage}\n\nSearch Results:\n${contextBlock.substring(0, 4000)}` 
              }
            ],
            ...llmOptions
          });
          
          // Parse JSON from LLM response
          let jsonStart = evaluationResponse.indexOf('{');
          let jsonEnd = evaluationResponse.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonStr = evaluationResponse.substring(jsonStart, jsonEnd + 1);
            const evalData = JSON.parse(jsonStr);
            isResolved = !!evalData.isResolved;
            justification = evalData.justification || '';
            finalAnswer = evalData.compiledAnswer || '';
            
            logger.info(`[DDG-SEARCH-RAG] Evaluation: isResolved = ${isResolved}. Justification: ${justification}`);
          } else {
            // Fallback if not JSON
            logger.warn(`[DDG-SEARCH-RAG] LLM response was not JSON: ${evaluationResponse}`);
            isResolved = true; // Stop loop
            justification = "Failed to parse evaluation JSON.";
            finalAnswer = evaluationResponse;
          }
        } catch (aiErr: any) {
          logger.error(`[DDG-SEARCH-RAG] LLM evaluation failed: ${aiErr.message}`);
          isResolved = true; // Stop loop on error
          justification = `LLM evaluation error: ${aiErr.message}`;
          finalAnswer = contextBlock;
        }
      }
      
      aiResponse = finalAnswer;
      logger.info(`[DDG-SEARCH-RAG] Final decision: passForward = ${isResolved}`);
      
      return {
        ...input,
        response: aiResponse,
        aiResponse: aiResponse,
        answer: aiResponse,
        output: aiResponse,
        justification: justification,
        passForward: isResolved, // This controls whether execution continues downstream!
        agent: node.name,
        model: model
      };
      
    } else if (model === 'rss-reader') {
      // RSS AI FEED ANALYZER (RAG-POWERED)
      const feedUrl = node.config?.feedUrl || input?.feedUrl || input?.body?.feedUrl || 'https://feeds.bbci.co.uk/news/rss.xml';
      logger.info(`[RSS-READER-RAG] Fetching and analyzing feed: ${feedUrl}`);
      
      const {
        systemPrompt,
        llmProvider,
        llmModel,
        llmApiKey,
        llmTemperature,
        maxItems = 10
      } = node.config || {};

      const limitVal = parseInt(maxItems as any) || 10;
      
      const response = await axios.get(feedUrl, { 
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
        timeout: 10000 
      });
      const xml = response.data;
      
      const items: any[] = [];
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>|<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && items.length < limitVal) {
        const content = match[1] || match[2];
        const getTag = (tag: string) => {
          const m = content.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 'is'));
          return m ? m[1].trim() : null;
        };
        items.push({
          title: getTag('title'),
          link: getTag('link') || content.match(/href="([^"]+)"/)?.[1] || null,
          description: getTag('description') || getTag('summary') || getTag('content'),
          pubDate: getTag('pubDate') || getTag('published') || getTag('updated'),
        });
      }
      
      const articlesContext = items.map((item, i) => 
        `[Article ${i + 1}] "${item.title || 'Untitled'}"\nDate: ${item.pubDate || 'Unknown'}\nURL: ${item.link || 'N/A'}\nContent: ${(item.description || '').substring(0, 300)}`
      ).join('\n\n---\n\n');
      
      const userContext = userMessage 
        ? `The user is specifically interested in: "${userMessage}"\nPlease focus on articles relevant to this topic.`
        : `Provide a general summary and highlights of the feed.`;
        
      try {
        const defaultSystemPrompt = `You are an AI content analyst. You've been given articles from an RSS feed. Your job is to:
1. Summarize the key themes and trends across all articles
2. Highlight the most important/relevant articles
3. If the user has a specific interest, filter and rank articles by relevance
4. Provide actionable insights from the content
5. Note any breaking news or time-sensitive information

Format: Start with a brief overview, then list key articles with why they matter.`;

        aiResponse = await callDynamicLLM({
          messages: [
            { role: 'system', content: systemPrompt || defaultSystemPrompt },
            { role: 'user', content: `**Feed URL:** ${feedUrl}\n**Total Articles:** ${items.length}\n\n${userContext}\n\n**Articles:**\n${articlesContext}` }
          ],
          provider: llmProvider || 'groq',
          model: llmModel,
          apiKey: llmApiKey,
          temperature: llmTemperature !== undefined ? llmTemperature : 0.5
        });
      } catch (aiErr: any) {
        logger.warn(`[RSS-READER-RAG] AI analysis failed: ${aiErr.message}`);
        aiResponse = articlesContext;
      }
      
    } else {
      // GPT-OSS-120B (default text AI reasoning)
      const messages: any[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: userMessage });

      aiResponse = await groqChat({
        messages,
        temperature: 0.7
      });
    }
    
    logger.info(`[AGENT] Response received`, { 
      nodeId: node.id, 
      responseLength: aiResponse.length 
    });
    
    return {
      ...input,
      response: aiResponse,
      aiResponse: aiResponse,
      answer: aiResponse,
      output: aiResponse,  // Add explicit output field for webhook response
      agent: node.name,
      model: model
    };
  } catch (error: any) {
    logger.error(`[AGENT] AI call failed:`, error.message);
    return {
      ...input,
      error: error.message,
      response: `AI Error: ${error.message}`
    };
  }
});

// ===========================================
// TAVILY WEB SEARCH HANDLER (also callable directly as model 'tavily-search')
// ===========================================

nodeHandlerRegistry.register('tavily-search', async (node, input, context) => {
  const { systemPrompt } = node.config;
  
  // Get search query from input
  const searchQuery = input?.body?.message || input?.body?.question || input?.body?.query || 
                      input?.message || input?.question || input?.query || 
                      (typeof input?.body === 'string' ? input.body : null) ||
                      (typeof input === 'string' ? input : '');
  
  logger.info(`[TAVILY] Searching for: ${searchQuery?.substring(0, 100)}`);
  
  if (!searchQuery) {
    return {
      ...input,
      error: 'No search query provided',
      response: 'Please provide a search query.'
    };
  }
  
  try {
    const response = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: TAVILY_API_KEY,
        query: searchQuery,
        max_results: 5,
        include_answer: true,
        include_raw_content: false
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    const data = response.data;
    
    // Format results
    let formattedResponse = '';
    
    if (data.answer) {
      formattedResponse += `**Summary:**\n${data.answer}\n\n`;
    }
    
    if (data.results && data.results.length > 0) {
      formattedResponse += `**Sources:**\n`;
      data.results.forEach((result: any, index: number) => {
        formattedResponse += `\n${index + 1}. **${result.title}**\n`;
        formattedResponse += `   ${result.content?.substring(0, 200)}...\n`;
        formattedResponse += `   🔗 ${result.url}\n`;
      });
    }
    
    logger.info(`[TAVILY] Search completed, found ${data.results?.length || 0} results`);
    
    return {
      ...input,
      response: formattedResponse,
      answer: data.answer || formattedResponse,
      aiResponse: formattedResponse,
      searchResults: data.results,
      query: searchQuery
    };
  } catch (error: any) {
    logger.error(`[TAVILY] Search failed:`, error.message);
    return {
      ...input,
      error: error.message,
      response: `Search Error: ${error.message}`
    };
  }
});

// ===========================================
// GROQ VISION HANDLER (also callable directly as model 'groq-vision')
// ===========================================

const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

nodeHandlerRegistry.register('groq-vision', async (node, input, context) => {
  const { systemPrompt } = node.config;
  
  // Get image data from input (base64 or URL)
  const imageData = input?.body?.image || input?.image || input?.body?.imageUrl || input?.imageUrl;
  const textPrompt = input?.body?.message || input?.body?.prompt || input?.message || 
                     systemPrompt || 'Extract all text from this image.';
  
  logger.info(`[GROQ-VISION] Processing image with prompt: ${textPrompt?.substring(0, 100)}`);
  
  if (!imageData) {
    // If no image, fall back to text-only mode with key rotation
    try {
      const aiResponse = await groqVisionChat({
        messages: [{ role: 'user', content: textPrompt }],
        model: GROQ_VISION_MODEL,
      }) || 'No response';
      
      return {
        ...input,
        response: aiResponse,
        answer: aiResponse,
        aiResponse: aiResponse
      };
    } catch (error: any) {
      logger.error(`[GROQ-VISION] Text processing failed:`, error.message);
      return {
        ...input,
        error: error.message,
        response: `Groq Error: ${error.message}`
      };
    }
  }
  
  try {
    // Build message content with image
    const messageContent: any[] = [
      { type: 'text', text: textPrompt }
    ];
    
    // Add image - check if it's a URL or base64
    if (imageData.startsWith('http')) {
      messageContent.push({
        type: 'image_url',
        image_url: { url: imageData }
      });
    } else {
      // Assume base64
      messageContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageData}` }
      });
    }
    
    const aiResponse = await groqVisionChat({
      messages: [{ role: 'user', content: messageContent }],
      model: GROQ_VISION_MODEL,
    }) || 'No text extracted';
    
    logger.info(`[GROQ-VISION] Extraction completed, ${aiResponse.length} chars`);
    
    return {
      ...input,
      response: aiResponse,
      answer: aiResponse,
      aiResponse: aiResponse,
      extractedText: aiResponse
    };
  } catch (error: any) {
    logger.error(`[GROQ-VISION] Image processing failed:`, error.message);
    return {
      ...input,
      error: error.message,
      response: `Vision Error: ${error.message}`
    };
  }
});

// TRIGGER node handler - alias for TRIGGER_WEBHOOK
nodeHandlerRegistry.register('TRIGGER', async (node, input, context) => {
  // Pass through webhook data
  return input || {};
});

// ===========================================
// TRIGGER NODES
// ===========================================

// Manual Trigger - Simply passes input through
nodeHandlerRegistry.register(NodeType.TRIGGER_MANUAL, async (node, input, context) => {
  logger.info(`Manual trigger activated: ${node.name}`);
  return input || { triggered: true, timestamp: new Date().toISOString() };
});

// Webhook Trigger - Already triggered by the webhook endpoint
// Passes through webhook payload data including body, query, headers
nodeHandlerRegistry.register(NodeType.TRIGGER_WEBHOOK, async (node, input, context) => {
  logger.info(`Webhook trigger processing: ${node.name}`);
  
  // Webhook input structure from server
  const webhookData = context.input?.webhook || input?.webhook || {};
  
  return {
    body: webhookData.body || input?.body || input,
    query: webhookData.query || input?.query || {},
    headers: webhookData.headers || input?.headers || {},
    method: webhookData.method || 'POST',
    path: webhookData.path || node.config.path || '',
    timestamp: webhookData.timestamp || new Date().toISOString(),
    // Pass through raw input as well
    _raw: input
  };
});

// Schedule Trigger - Already triggered by scheduler
nodeHandlerRegistry.register(NodeType.TRIGGER_SCHEDULE, async (node, input, context) => {
  logger.info(`Schedule trigger activated: ${node.name}`);
  return {
    triggered: true,
    scheduledTime: new Date().toISOString(),
    cronExpression: node.config.cronExpression,
    ...input,
  };
});

// ===========================================
// HTTP / API NODES
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_HTTP, async (node, input, context) => {
  const { url, method = 'GET', headers = {}, body } = node.config;

  if (!url) {
    throw new Error('HTTP node requires a URL');
  }

  // Interpolate variables in URL
  const resolvedUrl = interpolateString(url, input);
  const resolvedBody = body ? interpolateObject(body, input) : undefined;

  logger.debug(`HTTP Request: ${method} ${resolvedUrl}`);

  try {
    const response = await axios({
      method,
      url: resolvedUrl,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      data: resolvedBody,
      timeout: 30000,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
    };
  } catch (error: any) {
    if (error.response) {
      return {
        status: error.response.status,
        statusText: error.response.statusText,
        error: error.message,
        data: error.response.data,
      };
    }
    throw error;
  }
});

// ===========================================
// EMAIL NODE - Uses Resend API (HTTPS, no SMTP port blocking)
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_EMAIL, async (node, input, context) => {
  const { to, cc, bcc, subject, htmlBody, textBody } = node.config;

  if (!to || !subject) {
    throw new Error('Email node requires "to" and "subject"');
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured in .env');
  }

  const resolvedSubject = interpolateString(subject, input);
  const resolvedHtml = htmlBody ? interpolateString(htmlBody, input) : undefined;
  const resolvedText = textBody ? interpolateString(textBody, input) : JSON.stringify(input, null, 2);

  try {
    const response = await axios.post(
      'https://api.resend.com/emails',
      {
        from: EMAIL_FROM,
        to: Array.isArray(to) ? to : [to],
        cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
        subject: resolvedSubject,
        html: resolvedHtml,
        text: resolvedText,
      },
      {
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info(`Email sent to ${to} via Resend`);
    return {
      success: true,
      messageId: response.data.id,
      to: to,
    };
  } catch (error: any) {
    logger.error(`Email failed: ${error.response?.data?.message || error.message}`);
    throw new Error(error.response?.data?.message || error.message);
  }
});

// ===========================================
// CODE EXECUTION NODE
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_CODE, async (node, input, context) => {
  const { code, language = 'javascript' } = node.config;

  if (!code) {
    throw new Error('Code node requires code to execute');
  }

  if (language !== 'javascript') {
    throw new Error('Only JavaScript is supported in this version');
  }

  try {
    // Create a sandboxed function
    // In production, use vm2 or isolated-vm for proper sandboxing
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('input', 'context', `
      const $ = input;
      const $input = input;
      const $context = context;
      ${code}
    `);

    const result = await fn(input, {
      variables: context.variables,
      executionId: context.executionId,
    });

    return result ?? input;
  } catch (error: any) {
    logger.error(`Code execution failed: ${error.message}`);
    throw new Error(`Code execution error: ${error.message}`);
  }
});

// ===========================================
// DATA TRANSFORMATION NODES
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_SET, async (node, input, context) => {
  const { fields = {} } = node.config;

  const result = { ...input };
  
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      result[key] = interpolateString(value, input);
    } else {
      result[key] = value;
    }
  }

  return result;
});

nodeHandlerRegistry.register(NodeType.ACTION_FILTER, async (node, input, context) => {
  const { conditions = [] } = node.config;

  if (!Array.isArray(input)) {
    // Single item - check conditions
    for (const cond of conditions) {
      if (!evaluateCondition(input, cond)) {
        return null; // Filter out
      }
    }
    return input;
  }

  // Array - filter items
  return input.filter((item: any) => {
    for (const cond of conditions) {
      if (!evaluateCondition(item, cond)) {
        return false;
      }
    }
    return true;
  });
});

nodeHandlerRegistry.register(NodeType.ACTION_MERGE, async (node, input, context) => {
  // Input is already merged by the engine when multiple edges connect
  return input;
});

nodeHandlerRegistry.register(NodeType.ACTION_SPLIT, async (node, input, context) => {
  const { itemsPath } = node.config;

  if (itemsPath) {
    const items = getNestedValue(input, itemsPath);
    if (Array.isArray(items)) {
      return items;
    }
  }

  if (Array.isArray(input)) {
    return input;
  }

  return [input];
});

// ===========================================
// CONTROL FLOW NODES
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_SWITCH, async (node, input, context) => {
  const { conditions = [] } = node.config;

  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    if (evaluateCondition(input, cond)) {
      return {
        ...input,
        _switchOutput: cond.output ?? i,
        _matchedCondition: i,
      };
    }
  }

  // Default output
  return {
    ...input,
    _switchOutput: 'default',
    _matchedCondition: -1,
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_LOOP, async (node, input, context) => {
  const { itemsPath, batchSize = 1 } = node.config;

  let items = input;
  if (itemsPath) {
    items = getNestedValue(input, itemsPath);
  }

  if (!Array.isArray(items)) {
    items = [items];
  }

  // Return items for downstream processing
  return {
    items,
    batchSize,
    totalItems: items.length,
    batches: Math.ceil(items.length / batchSize),
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_WAIT, async (node, input, context) => {
  const { duration = 1, unit = 'seconds' } = node.config;

  const multipliers: Record<string, number> = {
    seconds: 1000,
    minutes: 60000,
    hours: 3600000,
    days: 86400000,
  };

  const ms = duration * (multipliers[unit] || 1000);
  
  logger.debug(`Waiting for ${duration} ${unit}`);
  await new Promise(resolve => setTimeout(resolve, ms));
  
  return {
    ...input,
    _waitedFor: { duration, unit },
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_RESPOND, async (node, input, context) => {
  // For webhook responses - allows custom HTTP response for sync webhooks
  const statusCode = node.config.statusCode || 200;
  const headers = node.config.headers || { 'Content-Type': 'application/json' };
  
  // Determine response body
  let body = node.config.body;
  if (!body) {
    // Use input as body if not explicitly set
    body = input;
  } else if (typeof body === 'string') {
    // Interpolate variables in body string
    body = interpolateString(body, input);
  }
  
  logger.info(`ACTION_RESPOND: Returning status ${statusCode}`);
  
  return {
    _isCustomResponse: true, // Flag for server to recognize this
    statusCode,
    headers,
    body,
    response: body // Alias for compatibility
  };
});

// ===========================================
// AI NODES
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_AI_CHAT, async (node, input, context) => {
  const { prompt, systemPrompt, model = 'gemini-2.5-flash', temperature = 0.7 } = node.config;

  const resolvedPrompt = interpolateString(prompt || JSON.stringify(input), input);

  const response = await aiService.chat({
    prompt: resolvedPrompt,
    systemPrompt: systemPrompt,
    model,
    temperature,
  });

  return {
    ...input,
    aiResponse: response,
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_AI_SUMMARIZE, async (node, input, context) => {
  const { model = 'gemini-2.5-flash' } = node.config;
  
  const textToSummarize = typeof input === 'string' 
    ? input 
    : input.text || JSON.stringify(input);

  const response = await aiService.chat({
    prompt: `Please summarize the following content concisely:\n\n${textToSummarize}`,
    systemPrompt: 'You are a helpful assistant that creates clear, concise summaries.',
    model,
  });

  return {
    original: input,
    summary: response,
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_AI_CLASSIFY, async (node, input, context) => {
  const { categories, model = 'gemini-2.5-flash' } = node.config;
  
  const textToClassify = typeof input === 'string' 
    ? input 
    : input.text || JSON.stringify(input);

  const categoryList = Array.isArray(categories) 
    ? categories.join(', ') 
    : 'positive, negative, neutral';

  const response = await aiService.chat({
    prompt: `Classify the following text into one of these categories: ${categoryList}\n\nText: ${textToClassify}\n\nRespond with just the category name.`,
    systemPrompt: 'You are a classification assistant. Respond only with the category name.',
    model,
    temperature: 0.1,
  });

  return {
    input: textToClassify,
    category: response.trim(),
    categories: categories,
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_AI_TRANSFORM, async (node, input, context) => {
  const { prompt, model = 'gemini-2.5-flash' } = node.config;
  
  const resolvedPrompt = interpolateString(prompt || 'Transform this data', input);

  const response = await aiService.chat({
    prompt: `${resolvedPrompt}\n\nInput data:\n${JSON.stringify(input, null, 2)}`,
    systemPrompt: 'You are a data transformation assistant. Output valid JSON when possible.',
    model,
  });

  // Try to parse as JSON
  try {
    return JSON.parse(response);
  } catch {
    return {
      transformed: response,
      original: input,
    };
  }
});

// ===========================================
// INTEGRATION NODES (Stubs - require credentials)
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_SLACK, async (node, input, context) => {
  const { channel, message, credentialId } = node.config;

  // Stub implementation - would use Slack SDK with OAuth token
  logger.info(`[STUB] Slack message to ${channel}: ${message}`);
  
  return {
    success: true,
    stub: true,
    channel,
    message: interpolateString(message || '', input),
    timestamp: new Date().toISOString(),
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_DISCORD, async (node, input, context) => {
  const { channel, message, webhookUrl } = node.config;

  if (webhookUrl) {
    const resolvedMessage = interpolateString(message || JSON.stringify(input), input);
    
    await axios.post(webhookUrl, {
      content: resolvedMessage,
    });

    return { success: true, message: resolvedMessage };
  }

  logger.info(`[STUB] Discord message: ${message}`);
  return { success: true, stub: true };
});

// ===========================================
// AI DATA AGENT - Process CSV/JSON with AI
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_DATABASE, async (node, input, context) => {
  const { uploadedData, dataQuery, dataLimit, transformQuery, dataSource, manualData, model } = node.config;
  
  logger.info(`[DATA AGENT] Processing with model: ${model || 'data-ai'}`);
  
  // Handle Data Agent (CSV/JSON with AI query)
  if (model === 'data-ai' || !model) {
    if (!uploadedData || !Array.isArray(uploadedData) || uploadedData.length === 0) {
      return {
        success: false,
        error: 'No data uploaded. Please upload a CSV or JSON file.',
        results: []
      };
    }
    
    const limit = dataLimit || 100;
    
    // If no query, return all data
    if (!dataQuery || dataQuery.trim() === '') {
      return {
        success: true,
        results: uploadedData.slice(0, limit),
        totalRecords: uploadedData.length,
        message: `Returned ${Math.min(limit, uploadedData.length)} of ${uploadedData.length} records`
      };
    }
    
    // Use AI to filter/query the data
    try {
      const sampleData = uploadedData.slice(0, 5);
      const fields = Object.keys(uploadedData[0] || {});
      
      const aiPrompt = `You are a data query assistant. Given the following data structure and sample records, generate a JavaScript filter function to match the user's query.

DATA FIELDS: ${fields.join(', ')}

SAMPLE DATA (first 5 records):
${JSON.stringify(sampleData, null, 2)}

USER QUERY: "${dataQuery}"

IMPORTANT: Return ONLY a valid JavaScript arrow function that can be used with Array.filter().
The function receives one record object and should return true if the record matches the query.
Do NOT include any explanation, just the function code.

Examples:
- Query "age over 30" → (r) => Number(r.age) > 30
- Query "status is active" → (r) => r.status === 'active' || r.status?.toLowerCase() === 'active'
- Query "name contains john" → (r) => r.name?.toLowerCase().includes('john')
- Query "price between 10 and 50" → (r) => Number(r.price) >= 10 && Number(r.price) <= 50

Return the filter function:`;

      const aiResponse = await aiService.chat({
        prompt: aiPrompt,
        systemPrompt: 'You are a precise code generator. Return only valid JavaScript code, no explanations.',
        temperature: 0.1
      });
      
      logger.info(`[DATA AGENT] AI generated filter: ${aiResponse}`);
      
      // Extract the function from AI response
      let filterCode = aiResponse.trim();
      // Remove markdown code blocks if present
      filterCode = filterCode.replace(/```javascript|```js|```/g, '').trim();
      
      // Try to create and apply the filter function
      try {
        // Create filter function from AI response
        const filterFn = new Function('r', `return (${filterCode})(r)`);
        
        // Apply filter to data
        const filteredData = uploadedData.filter((record: any) => {
          try {
            return filterFn(record);
          } catch (e) {
            return false;
          }
        });
        
        return {
          success: true,
          results: filteredData.slice(0, limit),
          totalRecords: filteredData.length,
          originalCount: uploadedData.length,
          query: dataQuery,
          aiFilter: filterCode,
          message: `Found ${filteredData.length} matching records (showing ${Math.min(limit, filteredData.length)})`
        };
      } catch (filterError) {
        logger.warn(`[DATA AGENT] Filter execution failed, falling back to simple search`);
        
        // Fallback: simple text search across all fields
        const searchTerms = dataQuery.toLowerCase().split(/\s+/);
        const filteredData = uploadedData.filter((record: any) => {
          const recordStr = JSON.stringify(record).toLowerCase();
          return searchTerms.some((term: string) => recordStr.includes(term));
        });
        
        return {
          success: true,
          results: filteredData.slice(0, limit),
          totalRecords: filteredData.length,
          originalCount: uploadedData.length,
          query: dataQuery,
          fallbackSearch: true,
          message: `Found ${filteredData.length} records containing search terms`
        };
      }
    } catch (aiError: any) {
      logger.error(`[DATA AGENT] AI query failed: ${aiError.message}`);
      return {
        success: false,
        error: `AI query failed: ${aiError.message}`,
        results: uploadedData.slice(0, limit)
      };
    }
  }
  
  // Handle JSON Transform
  if (model === 'data-transform') {
    let sourceData: any[] = [];
    
    if (dataSource === 'manual' && manualData) {
      try {
        sourceData = JSON.parse(manualData);
        if (!Array.isArray(sourceData)) sourceData = [sourceData];
      } catch (e) {
        return { success: false, error: 'Invalid JSON in manual data input' };
      }
    } else if (input && typeof input === 'object') {
      // Get data from previous node
      sourceData = input.results || input.data || (Array.isArray(input) ? input : [input]);
    }
    
    if (!sourceData || sourceData.length === 0) {
      return { success: false, error: 'No data to transform' };
    }
    
    if (!transformQuery || transformQuery.trim() === '') {
      return { success: true, results: sourceData, message: 'No transformation applied' };
    }
    
    // Use AI to transform the data
    try {
      const aiPrompt = `You are a data transformation assistant. Transform the following data according to the user's instructions.

INPUT DATA (${sourceData.length} records):
${JSON.stringify(sourceData.slice(0, 10), null, 2)}
${sourceData.length > 10 ? `... and ${sourceData.length - 10} more records` : ''}

TRANSFORMATION INSTRUCTIONS: "${transformQuery}"

Return the transformed data as a valid JSON array. Only return the JSON, no explanation.`;

      const aiResponse = await aiService.chat({
        prompt: aiPrompt,
        systemPrompt: 'You are a data transformation expert. Return only valid JSON arrays.',
        temperature: 0.2
      });
      
      // Parse the AI response as JSON
      let transformedData: any[];
      try {
        let jsonStr = aiResponse.trim();
        // Extract JSON from markdown if present
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();
        transformedData = JSON.parse(jsonStr);
        if (!Array.isArray(transformedData)) transformedData = [transformedData];
      } catch (parseError) {
        return { success: false, error: 'AI returned invalid JSON', rawResponse: aiResponse };
      }
      
      return {
        success: true,
        results: transformedData,
        originalCount: sourceData.length,
        transformedCount: transformedData.length,
        transformation: transformQuery,
        message: `Transformed ${sourceData.length} records into ${transformedData.length} records`
      };
    } catch (aiError: any) {
      return { success: false, error: `Transformation failed: ${aiError.message}` };
    }
  }
  
  // Fallback for unknown model
  return {
    success: false,
    error: `Unknown data model: ${model}`
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_GOOGLE_SHEETS, async (node, input, context) => {
  const { spreadsheetId, sheetName, operation, range, values, credentialId } = node.config;

  // Stub implementation - would use Google Sheets API
  logger.info(`[STUB] Google Sheets ${operation} on ${spreadsheetId}`);
  
  return {
    success: true,
    stub: true,
    spreadsheetId,
    sheetName,
    operation,
  };
});

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function interpolateString(template: string, data: any): string {
  if (!template) return '';
  
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(data, path.trim());
    return value !== undefined ? String(value) : match;
  });
}

function interpolateObject(obj: any, data: any): any {
  if (typeof obj === 'string') {
    return interpolateString(obj, data);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => interpolateObject(item, data));
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, data);
    }
    return result;
  }
  return obj;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

function evaluateCondition(data: any, condition: { field: string; operator: string; value: any }): boolean {
  const { field, operator, value } = condition;
  const fieldValue = getNestedValue(data, field);

  switch (operator) {
    case 'eq':
    case 'equals':
      return fieldValue === value;
    case 'neq':
    case 'notEquals':
      return fieldValue !== value;
    case 'gt':
      return fieldValue > value;
    case 'gte':
      return fieldValue >= value;
    case 'lt':
      return fieldValue < value;
    case 'lte':
      return fieldValue <= value;
    case 'contains':
      return String(fieldValue).includes(String(value));
    case 'notContains':
      return !String(fieldValue).includes(String(value));
    case 'regex':
      return new RegExp(value).test(String(fieldValue));
    case 'isEmpty':
      return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'isNotEmpty':
      return !!fieldValue && fieldValue !== '' && !(Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'exists':
      return fieldValue !== undefined;
    case 'notExists':
      return fieldValue === undefined;
    default:
      return true;
  }
}
