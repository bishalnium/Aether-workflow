// ===========================================
// AETHER WORKFLOW ENGINE - Main Server
// n8n-like automation backend
// ===========================================

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import axios from 'axios';
import { config } from './config/env';
import { authenticate, apiLimiter, AuthenticatedRequest } from './middleware/security';
import { logger } from './utils/logger';

// Services
import { workflowService } from './services/workflowService';
import { webhookService } from './services/webhookService';
import { schedulerService } from './services/schedulerService';
import { credentialService } from './services/credentialService';
import { jobQueueService } from './services/jobQueueService';
import { aiService } from './services/aiService';
import { executeWorkflow } from './engine/executionEngine';

// Routes
import authRoutes from './routes/auth';

// Integrations
import { slackService } from './integrations/slack';
import { emailService } from './integrations/email';

const app = express();

// --- Global Middleware ---
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// --- Auth Routes (OAuth) ---
app.use('/api/auth', authRoutes);

// --- Health Check ---
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: '2.0.0',
    env: config.NODE_ENV,
    services: {
      scheduler: 'active',
      webhooks: 'active',
      queue: jobQueueService.isAvailable() ? 'active' : 'fallback',
    },
  });
});

// ==========================================
// WORKFLOW ROUTES
// ==========================================

// List all workflows
app.get('/api/v1/workflows', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'anonymous';
    const workflows = await workflowService.list(userId);
    res.json({ success: true, data: workflows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single workflow
app.get('/api/v1/workflows/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'anonymous';
    const workflow = await workflowService.get(req.params.id, userId);
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    res.json({ success: true, data: workflow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create workflow
app.post('/api/v1/workflows', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'anonymous';
    const { id, name, description, nodes, edges, settings } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    
    const workflow = await workflowService.create(userId, { id, name, description, nodes, edges, settings });
    res.status(201).json({ success: true, data: workflow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update workflow
app.put('/api/v1/workflows/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'anonymous';
    const workflow = await workflowService.update(req.params.id, userId, req.body);
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    res.json({ success: true, data: workflow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete workflow
app.delete('/api/v1/workflows/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'anonymous';
    const success = await workflowService.delete(req.params.id, userId);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute workflow manually
app.post('/api/v1/workflows/:id/execute', authenticate, apiLimiter, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'anonymous';
    const workflow = await workflowService.get(req.params.id, userId);
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    // Use job queue if available, otherwise direct execution
    if (jobQueueService.isAvailable()) {
      const executionId = await jobQueueService.enqueue(workflow.id, req.body.input, {
        userId,
        mode: 'manual',
      });
      res.json({ success: true, data: { executionId, queued: true } });
    } else {
      const result = await executeWorkflow(workflow, req.body.input, userId, 'manual');
      res.json({ success: true, data: result });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get workflow executions
app.get('/api/v1/workflows/:id/executions', authenticate, async (req: Request, res: Response) => {
  try {
    const executions = await workflowService.getExecutions(req.params.id, 50);
    res.json({ success: true, data: executions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Duplicate workflow
app.post('/api/v1/workflows/:id/duplicate', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'anonymous';
    const workflow = await workflowService.duplicate(req.params.id, userId);
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    res.status(201).json({ success: true, data: workflow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export workflow
app.get('/api/v1/workflows/:id/export', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'anonymous';
    const data = await workflowService.export(req.params.id, userId);
    
    if (!data) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import workflow
app.post('/api/v1/workflows/import', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'anonymous';
    const workflow = await workflowService.import(userId, req.body);
    
    if (!workflow) {
      return res.status(400).json({ success: false, error: 'Invalid import data' });
    }
    
    res.status(201).json({ success: true, data: workflow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// WEBHOOK ROUTES
// ==========================================

// Register webhook
app.post('/api/v1/webhooks', authenticate, async (req: Request, res: Response) => {
  try {
    const { workflowId, path, method, authType, authConfig } = req.body;
    
    if (!workflowId) {
      return res.status(400).json({ success: false, error: 'workflowId is required' });
    }
    
    const webhook = await webhookService.register(workflowId, { path, method, authType, authConfig });
    res.status(201).json({ success: true, data: webhook });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Incoming webhook handler (public)
// Supports both async (fire-and-forget) and sync (wait for result) modes
app.all('/webhook/*', async (req: Request, res: Response) => {
  try {
    const path = req.path;
    
    // Get webhook configuration to check response mode
    const webhook = await webhookService.getByPath(path);
    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }
    
    const isSync = webhook.responseMode === 'onCompleted';
    
    // For async mode, respond immediately and process in background
    if (!isSync) {
      // Fire and forget - respond immediately
      res.json({ 
        success: true, 
        message: 'Webhook received, processing in background',
        webhookId: webhook.id
      });
      
      // Process webhook in background (don't await)
      webhookService.handleRequest({
        method: req.method,
        path,
        headers: req.headers as Record<string, string>,
        query: req.query as Record<string, string>,
        body: req.body,
        timestamp: new Date(),
      }).catch(err => {
        console.error('Background webhook execution error:', err);
      });
      
      return;
    }
    
    // Sync mode - wait for workflow execution result
    const result = await webhookService.handleRequest({
      method: req.method,
      path,
      headers: req.headers as Record<string, string>,
      query: req.query as Record<string, string>,
      body: req.body,
      timestamp: new Date(),
    });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    // Handle custom response from ACTION_RESPOND node
    if (result.response && result.response.statusCode) {
      // Apply custom headers if provided
      if (result.response.headers && typeof result.response.headers === 'object') {
        Object.entries(result.response.headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
      }
      
      // Send with custom status code and body
      const body = result.response.body || result.response.response || result.response;
      return res.status(result.response.statusCode).send(body);
    }
    
    // Default response for sync mode
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// SCHEDULER ROUTES
// ==========================================

// Schedule workflow
app.post('/api/v1/schedules', authenticate, async (req: Request, res: Response) => {
  try {
    const { workflowId, cronExpression, timezone } = req.body;
    
    if (!workflowId || !cronExpression) {
      return res.status(400).json({ success: false, error: 'workflowId and cronExpression required' });
    }
    
    const jobId = await schedulerService.schedule(workflowId, cronExpression, timezone);
    res.status(201).json({ success: true, data: { jobId } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List schedules
app.get('/api/v1/schedules', authenticate, async (req: Request, res: Response) => {
  try {
    const schedules = await schedulerService.list();
    res.json({ success: true, data: schedules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete schedule
app.delete('/api/v1/schedules/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const success = await schedulerService.remove(req.params.id);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate cron expression
app.post('/api/v1/schedules/validate', async (req: Request, res: Response) => {
  try {
    const { expression } = req.body;
    const isValid = schedulerService.validateCron(expression);
    const description = isValid ? schedulerService.describeCron(expression) : null;
    res.json({ success: true, data: { isValid, description } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// CREDENTIALS ROUTES
// ==========================================

// Store credential
app.post('/api/v1/credentials', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.email || authReq.user?.id || 'anonymous';
    const { name, type, data, provider, model } = req.body;
    
    if (!name || !type || !data) {
      return res.status(400).json({ success: false, error: 'name, type, and data required' });
    }
    
    const id = await credentialService.store(userId, name, type, data, provider, model);
    res.status(201).json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List credentials (no sensitive data)
app.get('/api/v1/credentials', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.email || authReq.user?.id || 'anonymous';
    const credentials = await credentialService.list(userId);
    res.json({ success: true, data: credentials });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete credential
app.delete('/api/v1/credentials/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.email || authReq.user?.id || 'anonymous';
    const success = await credentialService.delete(req.params.id, userId);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// AI ROUTES
// ==========================================

// Generate workflow from description
app.post('/api/v1/ai/generate-workflow', authenticate, apiLimiter, async (req: Request, res: Response) => {
  try {
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ success: false, error: 'description is required' });
    }
    
    const workflow = await aiService.generateWorkflow(description);
    res.json({ success: true, data: workflow });
  } catch (error: any) {
    logger.error('AI workflow generation failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI Chat (for workflow assistance)
app.post('/api/v1/ai/chat', authenticate, apiLimiter, async (req: Request, res: Response) => {
  try {
    const { prompt, systemPrompt, model, temperature } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'prompt is required' });
    }
    
    const response = await aiService.chat({ prompt, systemPrompt, model, temperature });
    res.json({ success: true, data: { response } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze workflow
app.post('/api/v1/ai/analyze-workflow', authenticate, async (req: Request, res: Response) => {
  try {
    const { workflow } = req.body;
    
    if (!workflow) {
      return res.status(400).json({ success: false, error: 'workflow is required' });
    }
    
    const analysis = await aiService.analyzeWorkflow(workflow);
    res.json({ success: true, data: { analysis } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// EXECUTION ROUTES
// ==========================================

// Get execution details
app.get('/api/v1/executions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const execution = workflowService.getExecution(req.params.id);
    
    if (!execution) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }
    
    res.json({ success: true, data: execution });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get queue stats
app.get('/api/v1/queue/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const stats = await jobQueueService.getStats();
    res.json({ success: true, data: stats || { message: 'Queue not available' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// STATS ROUTES
// ==========================================

// Get user stats
app.get('/api/v1/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'anonymous';
    const stats = workflowService.getStats(userId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// NODE TYPES INFO
// ==========================================

// Get available node types
app.get('/api/v1/node-types', async (req: Request, res: Response) => {
  const nodeTypes = {
    triggers: [
      { type: 'TRIGGER_MANUAL', name: 'Manual Trigger', description: 'Start workflow manually', icon: 'Play' },
      { type: 'TRIGGER_WEBHOOK', name: 'Webhook', description: 'Start from HTTP request', icon: 'Webhook' },
      { type: 'TRIGGER_SCHEDULE', name: 'Schedule', description: 'Run on cron schedule', icon: 'Clock' },
    ],
    actions: [
      { type: 'ACTION_HTTP', name: 'HTTP Request', description: 'Make API calls', icon: 'Globe' },
      { type: 'ACTION_CODE', name: 'Code', description: 'Run custom JavaScript', icon: 'Code' },
      { type: 'ACTION_SET', name: 'Set', description: 'Set/transform data', icon: 'Settings' },
      { type: 'ACTION_FILTER', name: 'Filter', description: 'Filter data items', icon: 'Filter' },
      { type: 'ACTION_SWITCH', name: 'Switch', description: 'Conditional routing', icon: 'GitBranch' },
      { type: 'ACTION_LOOP', name: 'Loop', description: 'Iterate over items', icon: 'Repeat' },
      { type: 'ACTION_WAIT', name: 'Wait', description: 'Delay execution', icon: 'Clock' },
      { type: 'ACTION_MERGE', name: 'Merge', description: 'Merge multiple inputs', icon: 'Merge' },
    ],
    integrations: [
      { type: 'ACTION_EMAIL', name: 'Email', description: 'Send emails via SMTP', icon: 'Mail' },
      { type: 'ACTION_SLACK', name: 'Slack', description: 'Post to Slack channels', icon: 'MessageSquare' },
      { type: 'ACTION_DISCORD', name: 'Discord', description: 'Send Discord messages', icon: 'MessageCircle' },
      { type: 'ACTION_DATABASE', name: 'Database', description: 'Query databases', icon: 'Database' },
      { type: 'ACTION_GOOGLE_SHEETS', name: 'Google Sheets', description: 'Read/write spreadsheets', icon: 'Table' },
    ],
    ai: [
      { type: 'ACTION_AI_CHAT', name: 'AI Chat', description: 'Generate AI responses', icon: 'Bot' },
      { type: 'ACTION_AI_SUMMARIZE', name: 'AI Summarize', description: 'Summarize text', icon: 'FileText' },
      { type: 'ACTION_AI_CLASSIFY', name: 'AI Classify', description: 'Classify content', icon: 'Tags' },
      { type: 'ACTION_AI_TRANSFORM', name: 'AI Transform', description: 'Transform data with AI', icon: 'Wand' },
    ],
  };
  
  res.json({ success: true, data: nodeTypes });
});

// --- Integration API Endpoints ---

// Test all integrations
app.get('/api/v1/integrations/status', async (req: Request, res: Response) => {
  const status = {
    slack: { configured: false, connected: false, error: null as string | null },
    email: { configured: false, connected: false, error: null as string | null },
    github: { configured: false },
    google: { configured: false },
  };
  
  // Check Slack
  if (process.env.SLACK_BOT_TOKEN) {
    status.slack.configured = true;
    try {
      const result = await slackService.testConnection();
      status.slack.connected = result.ok;
      if (!result.ok) status.slack.error = result.error || 'Unknown error';
    } catch (e: any) {
      status.slack.error = e.message;
    }
  }
  
  // Check Email
  if (process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_USER) {
    status.email.configured = true;
    try {
      const result = await emailService.testConnection();
      status.email.connected = result.success;
      if (!result.success) status.email.error = result.error || 'Unknown error';
    } catch (e: any) {
      status.email.error = e.message;
    }
  }
  
  // Check OAuth
  status.github.configured = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  status.google.configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  
  res.json({ success: true, data: status });
});

// Send Slack message
app.post('/api/v1/integrations/slack/send', async (req: Request, res: Response) => {
  try {
    const { channel, message, blocks } = req.body;
    
    if (!channel || !message) {
      return res.status(400).json({ success: false, error: 'Channel and message are required' });
    }
    
    let result;
    if (blocks) {
      result = await slackService.sendRichMessage(channel, blocks, message);
    } else {
      result = await slackService.sendMessage({ channel, text: message });
    }
    
    if (result.ok) {
      res.json({ success: true, data: { ts: result.ts, channel: result.channel } });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List Slack channels
app.get('/api/v1/integrations/slack/channels', async (req: Request, res: Response) => {
  try {
    const channels = await slackService.listChannels();
    res.json({ success: true, data: channels });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send Email
app.post('/api/v1/integrations/email/send', async (req: Request, res: Response) => {
  try {
    const { to, subject, text, html } = req.body;
    
    if (!to || !subject) {
      return res.status(400).json({ success: false, error: 'To and subject are required' });
    }
    
    if (!text && !html) {
      return res.status(400).json({ success: false, error: 'Either text or html body is required' });
    }
    
    console.log(`[EMAIL] Sending email to: ${to}, subject: ${subject}`);
    const result = await emailService.send({ to, subject, text, html });
    
    if (!result.success) {
      console.error(`[EMAIL] Failed: ${result.error}`);
      return res.status(500).json({ success: false, error: result.error || 'Failed to send email' });
    }
    
    console.log(`[EMAIL] Sent successfully! MessageId: ${result.messageId}`);
    res.json({ success: true, data: { messageId: result.messageId } });
  } catch (error: any) {
    console.error(`[EMAIL] Exception: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test Email connection
app.get('/api/v1/integrations/email/test', async (req: Request, res: Response) => {
  try {
    const connected = await emailService.testConnection();
    res.json({ success: true, data: { connected } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// DUCKDUCKGO AI WEB RESEARCH (RAG-POWERED)
// AI formulates query → Search → AI analyzes & summarizes
// ===========================================
app.post('/api/v1/integrations/ddg/search', authenticate, async (req: Request, res: Response) => {
  try {
    const { 
      query,
      systemPrompt,
      llmProvider,
      llmModel,
      llmApiKey,
      llmTemperature
    } = req.body;
    
    if (!query) return res.status(400).json({ success: false, error: 'Query is required' });

    const { callDynamicLLM } = require('./utils/llmClient');

    logger.info(`[DDG RAG ROUTE] Initiating RAG Agent Loop for: "${query}" using provider=${llmProvider || 'groq'}`);

    const llmOptions = {
      provider: llmProvider || 'groq',
      model: llmModel,
      apiKey: llmApiKey,
      temperature: llmTemperature !== undefined ? llmTemperature : 0.3
    };

    let attempts = 0;
    const maxAttempts = 2;
    let allSearchResults: string[] = [];
    let lastQuery = query;
    let isResolved = false;
    let justification = '';
    let finalAnswer = '';

    while (attempts < maxAttempts && !isResolved) {
      attempts++;
      logger.info(`[DDG RAG ROUTE] Attempt ${attempts}/${maxAttempts}`);

      // Step 1: Formulate search query using LLM
      let searchQuery = query;
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
              { role: 'user', content: query }
            ],
            ...llmOptions,
            temperature: 0.3
          });
          searchQuery = queryResponse.trim().replace(/^["']|["']$/g, '') || query;
        } catch (aiErr: any) {
          logger.warn(`[DDG RAG ROUTE] Attempt 1 query optimization failed: ${aiErr.message}`);
          searchQuery = query;
        }
      } else {
        // Refinement
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
              { role: 'user', content: `Original Question: ${query}\n\nPrevious Findings:\n${contextText.substring(0, 2000)}` }
            ],
            ...llmOptions,
            temperature: 0.3
          });
          searchQuery = refinementResponse.trim().replace(/^["']|["']$/g, '') || query;
        } catch (aiErr: any) {
          logger.warn(`[DDG RAG ROUTE] Attempt ${attempts} query refinement failed: ${aiErr.message}`);
          searchQuery = query;
        }
      }

      lastQuery = searchQuery;
      logger.info(`[DDG RAG ROUTE] Running search for query: "${searchQuery}"`);

      // Step 2: Fetch search results
      let searchData: any = {};
      try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1`;
        const response = await axios.get(url, { timeout: 8000 });
        searchData = response.data;
      } catch (searchErr: any) {
        logger.error(`[DDG RAG ROUTE] Search request failed: ${searchErr.message}`);
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
      logger.info(`[DDG RAG ROUTE] Evaluating results with LLM...`);
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
              content: `User's Question: ${query}\n\nSearch Results:\n${contextBlock.substring(0, 4000)}` 
            }
          ],
          ...llmOptions
        });

        // Parse JSON
        let jsonStart = evaluationResponse.indexOf('{');
        let jsonEnd = evaluationResponse.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonStr = evaluationResponse.substring(jsonStart, jsonEnd + 1);
          const evalData = JSON.parse(jsonStr);
          isResolved = !!evalData.isResolved;
          justification = evalData.justification || '';
          finalAnswer = evalData.compiledAnswer || '';
          logger.info(`[DDG RAG ROUTE] Evaluation: isResolved = ${isResolved}. Justification: ${justification}`);
        } else {
          logger.warn(`[DDG RAG ROUTE] LLM response was not JSON: ${evaluationResponse}`);
          isResolved = true; // Stop loop
          justification = "Failed to parse evaluation JSON.";
          finalAnswer = evaluationResponse;
        }
      } catch (aiErr: any) {
        logger.error(`[DDG RAG ROUTE] LLM evaluation failed: ${aiErr.message}`);
        isResolved = true; // Stop loop on error
        justification = `LLM evaluation error: ${aiErr.message}`;
        finalAnswer = contextBlock;
      }
    }

    res.json({
      success: true,
      data: {
        query,
        searchQuery: lastQuery,
        answer: finalAnswer,
        passForward: isResolved,
        justification,
        attempts
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: `Web Research Error: ${error.message}` });
  }
});

// ===========================================
// RSS AI FEED ANALYZER (RAG-POWERED)
// Fetch feed → AI analyzes & summarizes content
// ===========================================
app.post('/api/v1/integrations/rss/fetch', authenticate, async (req: Request, res: Response) => {
  try {
    const { 
      feedUrl, 
      maxItems = 10, 
      query, 
      rawMode,
      systemPrompt,
      llmProvider,
      llmModel,
      llmApiKey,
      llmTemperature
    } = req.body;
    
    if (!feedUrl) return res.status(400).json({ success: false, error: 'Feed URL is required' });

    // --- STEP 1: Fetch and parse the RSS/Atom feed ---
    const response = await axios.get(feedUrl, { 
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
      timeout: 10000 
    });
    const xml = response.data;

    const items: any[] = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>|<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
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

    // If rawMode, return just the parsed articles
    if (rawMode) {
      return res.json({ success: true, data: items });
    }

    // --- STEP 2: AI analyzes the feed content ---
    const { callDynamicLLM } = require('./utils/llmClient');

    // Build a context block from all articles
    const articlesContext = items.map((item, i) => 
      `[Article ${i + 1}] "${item.title || 'Untitled'}"\nDate: ${item.pubDate || 'Unknown'}\nURL: ${item.link || 'N/A'}\nContent: ${(item.description || '').substring(0, 300)}`
    ).join('\n\n---\n\n');

    const userContext = query 
      ? `The user is specifically interested in: "${query}"\nPlease focus on articles relevant to this topic.`
      : `Provide a general summary and highlights of the feed.`;

    let aiAnalysis: string;
    try {
      const defaultSystemPrompt = `You are an AI content analyst. You've been given articles from an RSS feed. Your job is to:
1. Summarize the key themes and trends across all articles
2. Highlight the most important/relevant articles
3. If the user has a specific interest, filter and rank articles by relevance
4. Provide actionable insights from the content
5. Note any breaking news or time-sensitive information

Format: Start with a brief overview, then list key articles with why they matter.`;

      aiAnalysis = await callDynamicLLM({
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
      logger.warn(`[RSS RAG] AI analysis failed: ${aiErr.message}`);
      aiAnalysis = `[AI analysis unavailable — ${items.length} raw articles returned]`;
    }

    // --- STEP 3: Return intelligent response ---
    const result = {
      feedUrl,
      totalArticles: items.length,
      analysis: aiAnalysis,
      articles: items.map(item => ({
        title: item.title,
        link: item.link,
        date: item.pubDate,
        snippet: item.description ? item.description.substring(0, 200) + '...' : null,
      })),
    };

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: `RSS Feed Error: ${error.message}` });
  }
});

// ===========================================
// GITHUB INTEGRATION (USER'S OWN TOKEN)
// ===========================================
app.post('/api/v1/integrations/github/execute', authenticate, async (req: Request, res: Response) => {
  try {
    const { token, action, owner, repo, issueTitle, issueBody, filePath } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'GitHub token is required' });

    const ghHeaders = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    let result: any;

    switch (action) {
      case 'list-repos': {
        const resp = await axios.get('https://api.github.com/user/repos?sort=updated&per_page=30', { headers: ghHeaders });
        result = resp.data.map((r: any) => ({
          name: r.full_name, description: r.description, stars: r.stargazers_count,
          language: r.language, url: r.html_url, private: r.private, updated: r.updated_at
        }));
        break;
      }
      case 'list-issues': {
        if (!owner || !repo) return res.status(400).json({ success: false, error: 'Owner and repo are required' });
        const resp = await axios.get(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=20`, { headers: ghHeaders });
        result = resp.data.map((i: any) => ({
          number: i.number, title: i.title, state: i.state, user: i.user?.login,
          labels: i.labels?.map((l: any) => l.name), created: i.created_at, url: i.html_url
        }));
        break;
      }
      case 'create-issue': {
        if (!owner || !repo) return res.status(400).json({ success: false, error: 'Owner and repo are required' });
        const resp = await axios.post(`https://api.github.com/repos/${owner}/${repo}/issues`, 
          { title: issueTitle || 'New Issue', body: issueBody || '' }, { headers: ghHeaders });
        result = { number: resp.data.number, title: resp.data.title, url: resp.data.html_url, state: resp.data.state };
        break;
      }
      case 'read-file': {
        if (!owner || !repo) return res.status(400).json({ success: false, error: 'Owner and repo are required' });
        const resp = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath || 'README.md'}`, { headers: ghHeaders });
        const content = Buffer.from(resp.data.content, 'base64').toString('utf-8');
        result = { path: resp.data.path, size: resp.data.size, content };
        break;
      }
      case 'list-commits': {
        if (!owner || !repo) return res.status(400).json({ success: false, error: 'Owner and repo are required' });
        const resp = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`, { headers: ghHeaders });
        result = resp.data.map((c: any) => ({
          sha: c.sha.substring(0, 7), message: c.commit.message, author: c.commit.author.name,
          date: c.commit.author.date, url: c.html_url
        }));
        break;
      }
      default:
        return res.status(400).json({ success: false, error: `Unknown GitHub action: ${action}` });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    res.status(error.response?.status || 500).json({ success: false, error: `GitHub API Error: ${msg}` });
  }
});

// ===========================================
// TELEGRAM BOT (USER'S OWN TOKEN)
// ===========================================
app.post('/api/v1/integrations/telegram/execute', authenticate, async (req: Request, res: Response) => {
  try {
    const { token, action, chatId, message, photoUrl } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Telegram bot token is required' });

    const baseUrl = `https://api.telegram.org/bot${token}`;
    let result: any;

    switch (action) {
      case 'send-message': {
        if (!chatId) return res.status(400).json({ success: false, error: 'Chat ID is required' });
        const resp = await axios.post(`${baseUrl}/sendMessage`, {
          chat_id: chatId, text: message || 'Hello from Aether!', parse_mode: 'Markdown'
        });
        result = { messageId: resp.data.result?.message_id, chat: resp.data.result?.chat?.title || chatId, sent: true };
        break;
      }
      case 'send-photo': {
        if (!chatId) return res.status(400).json({ success: false, error: 'Chat ID is required' });
        const resp = await axios.post(`${baseUrl}/sendPhoto`, {
          chat_id: chatId, photo: photoUrl || '', caption: message || ''
        });
        result = { messageId: resp.data.result?.message_id, sent: true };
        break;
      }
      case 'get-updates': {
        const resp = await axios.get(`${baseUrl}/getUpdates?limit=10`);
        result = (resp.data.result || []).map((u: any) => ({
          updateId: u.update_id,
          from: u.message?.from?.username || u.message?.from?.first_name,
          text: u.message?.text,
          date: u.message?.date ? new Date(u.message.date * 1000).toISOString() : null,
          chatId: u.message?.chat?.id
        }));
        break;
      }
      default:
        return res.status(400).json({ success: false, error: `Unknown Telegram action: ${action}` });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    const msg = error.response?.data?.description || error.message;
    res.status(500).json({ success: false, error: `Telegram API Error: ${msg}` });
  }
});

// ===========================================
// NOTION (USER'S OWN TOKEN)
// ===========================================
app.post('/api/v1/integrations/notion/execute', authenticate, async (req: Request, res: Response) => {
  try {
    const { token, action, databaseId, properties, query } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Notion token is required' });

    const notionHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    };

    let result: any;

    switch (action) {
      case 'query-database': {
        if (!databaseId) return res.status(400).json({ success: false, error: 'Database ID is required' });
        const resp = await axios.post(`https://api.notion.com/v1/databases/${databaseId}/query`, {}, { headers: notionHeaders });
        result = (resp.data.results || []).map((page: any) => {
          const props: any = {};
          for (const [key, val] of Object.entries(page.properties || {})) {
            const v = val as any;
            if (v.title) props[key] = v.title[0]?.text?.content || '';
            else if (v.rich_text) props[key] = v.rich_text[0]?.text?.content || '';
            else if (v.number !== undefined) props[key] = v.number;
            else if (v.select) props[key] = v.select?.name || '';
            else if (v.multi_select) props[key] = v.multi_select?.map((s: any) => s.name) || [];
            else if (v.checkbox !== undefined) props[key] = v.checkbox;
            else if (v.url) props[key] = v.url;
            else if (v.date) props[key] = v.date?.start || '';
            else props[key] = v.type || 'unknown';
          }
          return { id: page.id, url: page.url, ...props };
        });
        break;
      }
      case 'create-page': {
        if (!databaseId) return res.status(400).json({ success: false, error: 'Database ID is required' });
        let parsedProps = {};
        try { parsedProps = typeof properties === 'string' ? JSON.parse(properties) : (properties || {}); } catch {}
        const resp = await axios.post('https://api.notion.com/v1/pages', {
          parent: { database_id: databaseId },
          properties: parsedProps
        }, { headers: notionHeaders });
        result = { id: resp.data.id, url: resp.data.url, created: true };
        break;
      }
      case 'search': {
        const resp = await axios.post('https://api.notion.com/v1/search', {
          query: query || '', page_size: 10
        }, { headers: notionHeaders });
        result = (resp.data.results || []).map((item: any) => ({
          id: item.id, type: item.object, url: item.url,
          title: item.properties?.Name?.title?.[0]?.text?.content || item.properties?.title?.title?.[0]?.text?.content || 'Untitled'
        }));
        break;
      }
      default:
        return res.status(400).json({ success: false, error: `Unknown Notion action: ${action}` });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    res.status(error.response?.status || 500).json({ success: false, error: `Notion API Error: ${msg}` });
  }
});

// ===========================================
// DISCORD WEBHOOK (USER'S OWN WEBHOOK URL)
// ===========================================
app.post('/api/v1/integrations/discord/send', authenticate, async (req: Request, res: Response) => {
  try {
    const { webhookUrl, message, action, embedTitle, embedColor } = req.body;
    if (!webhookUrl) return res.status(400).json({ success: false, error: 'Discord webhook URL is required' });
    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      return res.status(400).json({ success: false, error: 'Invalid Discord webhook URL format' });
    }

    let payload: any;
    if (action === 'send-embed') {
      payload = {
        embeds: [{
          title: embedTitle || 'Aether Workflow',
          description: message || 'Notification from Aether',
          color: parseInt((embedColor || '5865F2').replace('#', ''), 16),
          timestamp: new Date().toISOString(),
          footer: { text: 'Sent via Aether Workflow' }
        }]
      };
    } else {
      payload = { content: message || 'Hello from Aether Workflow!' };
    }

    const resp = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    // Discord returns 204 No Content on success
    res.json({ success: true, data: { sent: true, status: resp.status } });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    res.status(500).json({ success: false, error: `Discord Error: ${msg}` });
  }
});

// ===========================================
// GOOGLE SHEETS (USER'S SERVICE ACCOUNT)
// ===========================================

// Helper: extract spreadsheet ID from URL or raw ID
function extractSpreadsheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

// Helper: normalize any rowData into a clean 2D string array for Google Sheets API
function normalizeRowData(raw: any): string[][] {
  // 1) If it's a string, try parsing as JSON first
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { /* not JSON, handle as plain text below */ }
  }

  // 2) If it's still a plain string (not parsed), try comma-separated
  if (typeof raw === 'string') {
    // Check if it looks like key:value pairs (e.g., "Name: John, Email: john@email.com")
    const kvPairs = raw.match(/(\w[\w\s]*?):\s*([^,]+)/g);
    if (kvPairs && kvPairs.length >= 2) {
      const headers: string[] = [];
      const values: string[] = [];
      kvPairs.forEach((pair: string) => {
        const [key, ...rest] = pair.split(':');
        headers.push(key.trim());
        values.push(rest.join(':').trim());
      });
      return [headers, values];
    }
    return [raw.split(',').map((s: string) => s.trim())];
  }

  // 3) If it's already a 2D array like [["a","b"]]
  if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) {
    return raw.map((row: any[]) => row.map(String));
  }

  // 4) If it's a flat array like ["Jane", "jane@example.com"]
  if (Array.isArray(raw)) {
    return [raw.map(String)];
  }

  // 5) If it's an object with named keys like {"name":"Jane", "email":"jane@..."}
  //    Create a header row from keys and a data row from values for proper column mapping
  if (typeof raw === 'object' && raw !== null) {
    // Filter out internal/meta keys
    const skipKeys = new Set(['input', '_raw', '_source', '_timestamp']);
    const entries = Object.entries(raw).filter(([key]) => !skipKeys.has(key));
    
    if (entries.length > 0) {
      const headers = entries.map(([key]) => 
        key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) // snake_case → Title Case
      );
      const values = entries.map(([, val]) => String(val));
      return [headers, values];
    }
    
    const vals = Object.values(raw).map(String);
    return [vals];
  }

  // 6) Fallback — wrap in a cell
  return [[String(raw)]];
}

app.post('/api/v1/integrations/sheets/execute', authenticate, async (req: Request, res: Response) => {
  try {
    let { action, sheetsId, range, rowData, serviceAccountJson } = req.body;
    if (!sheetsId) return res.status(400).json({ success: false, error: 'Spreadsheet ID is required' });

    // Auto-extract ID from full Google Sheets URL
    sheetsId = extractSpreadsheetId(sheetsId);

    // Fall back to env-stored service account if user didn't provide one
    const saJson = serviceAccountJson || process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON || '';
    if (!saJson) return res.status(400).json({ success: false, error: 'Service Account JSON is required. Paste it in the config panel or set GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON in backend .env' });

    // Parse service account credentials
    let credentials: any;
    try {
      credentials = typeof saJson === 'string' ? JSON.parse(saJson) : saJson;
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid Service Account JSON — must be valid JSON' });
    }

    // Get OAuth2 token from Google using JWT
    const { google } = require('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const effectiveRange = range || 'Sheet1!A1:Z100';

    let result: any;
    switch (action) {
      case 'read-sheet': {
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetsId,
          range: effectiveRange,
        });
        result = { rows: resp.data.values || [], range: resp.data.range, rowCount: (resp.data.values || []).length };
        break;
      }
      case 'append-row': {
        const values = normalizeRowData(rowData);
        console.log('[SHEETS] Appending row:', JSON.stringify(values));
        const resp = await sheets.spreadsheets.values.append({
          spreadsheetId: sheetsId,
          range: effectiveRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });
        result = { appended: true, updatedRange: resp.data.updates?.updatedRange, updatedRows: resp.data.updates?.updatedRows };
        break;
      }
      case 'update-cell': {
        const values = normalizeRowData(rowData);
        console.log('[SHEETS] Updating cell:', JSON.stringify(values));
        const resp = await sheets.spreadsheets.values.update({
          spreadsheetId: sheetsId,
          range: effectiveRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });
        result = { updated: true, updatedRange: resp.data.updatedRange, updatedCells: resp.data.updatedCells };
        break;
      }
      default:
        return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    const msg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ success: false, error: `Google Sheets Error: ${msg}` });
  }
});
// ===========================================
// FIREBASE FIRESTORE (USER'S OWN SERVICE ACCOUNT)
// ===========================================
app.post('/api/v1/integrations/firebase/execute', authenticate, async (req: Request, res: Response) => {
  try {
    const { action, serviceAccountJson, documentPath, collectionPath, data: docData, query: queryField } = req.body;
    if (!serviceAccountJson) return res.status(400).json({ success: false, error: 'Firebase Service Account JSON is required' });

    // Parse service account credentials
    let credentials: any;
    try {
      credentials = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid Service Account JSON — must be valid JSON' });
    }

    if (!credentials.project_id) {
      return res.status(400).json({ success: false, error: 'Service Account JSON must contain a project_id' });
    }

    // Initialize Firebase Admin with the user's service account
    // Use a unique app name per project to avoid conflicts between different users
    const admin = require('firebase-admin');
    const appName = `aether_${credentials.project_id}_${Date.now()}`;
    let firebaseApp;
    
    try {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(credentials),
        projectId: credentials.project_id,
      }, appName);
    } catch (initErr: any) {
      return res.status(400).json({ success: false, error: `Firebase init failed: ${initErr.message}` });
    }

    const db = firebaseApp.firestore();
    let result: any;

    try {
      switch (action) {
        case 'read-doc': {
          if (!documentPath) {
            result = { error: 'Document path is required (e.g., users/user123)' };
            break;
          }
          const docRef = db.doc(documentPath);
          const doc = await docRef.get();
          if (!doc.exists) {
            result = { exists: false, path: documentPath, data: null };
          } else {
            result = { exists: true, path: documentPath, id: doc.id, data: doc.data() };
          }
          break;
        }

        case 'write-doc': {
          if (!documentPath) {
            result = { error: 'Document path is required (e.g., users/user123)' };
            break;
          }
          let writeData: any = {};
          try {
            writeData = typeof docData === 'string' ? JSON.parse(docData) : (docData || {});
          } catch {
            writeData = { value: docData };
          }
          // Add a timestamp
          writeData._updatedAt = new Date().toISOString();
          writeData._updatedBy = 'aether-workflow';
          
          await db.doc(documentPath).set(writeData, { merge: true });
          result = { written: true, path: documentPath, data: writeData };
          break;
        }

        case 'query-collection': {
          if (!collectionPath) {
            result = { error: 'Collection path is required (e.g., users)' };
            break;
          }
          let collRef: any = db.collection(collectionPath);
          
          // Apply simple query filters if provided
          if (queryField) {
            try {
              const queryParsed = typeof queryField === 'string' ? JSON.parse(queryField) : queryField;
              // Support: { field: "status", op: "==", value: "active" }
              if (queryParsed.field && queryParsed.op && queryParsed.value !== undefined) {
                collRef = collRef.where(queryParsed.field, queryParsed.op, queryParsed.value);
              }
            } catch {
              // If query parse fails, just fetch all
            }
          }
          
          const snapshot = await collRef.limit(50).get();
          const docs: any[] = [];
          snapshot.forEach((doc: any) => {
            docs.push({ id: doc.id, ...doc.data() });
          });
          result = { collection: collectionPath, count: docs.length, documents: docs };
          break;
        }

        case 'delete-doc': {
          if (!documentPath) {
            result = { error: 'Document path is required (e.g., users/user123)' };
            break;
          }
          await db.doc(documentPath).delete();
          result = { deleted: true, path: documentPath };
          break;
        }

        default:
          result = { error: `Unknown Firebase action: ${action}. Supported: read-doc, write-doc, query-collection, delete-doc` };
      }
    } finally {
      // Clean up: delete the temporary Firebase app to prevent memory leaks
      await firebaseApp.delete();
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    const msg = error.code ? `${error.code}: ${error.message}` : error.message;
    res.status(500).json({ success: false, error: `Firebase Error: ${msg}` });
  }
});

// ===========================================
// DATABASE OPERATIONS ENDPOINT
// ===========================================
app.post('/api/v1/database/execute', authenticate, async (req: Request, res: Response) => {
  try {
    const { operation, table, filter, limit, data, dbType, connectionString } = req.body;

    if (!table) {
      return res.status(400).json({ success: false, error: 'Table name is required' });
    }

    // SQLite - use Prisma's raw queries on the local database
    if (!dbType || dbType === 'sqlite') {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      try {
        if (operation === 'select') {
          let query = `SELECT * FROM "${table}"`;
          const params: any[] = [];
          
          if (filter) {
            try {
              const filterObj = typeof filter === 'string' ? JSON.parse(filter) : filter;
              const conditions = Object.entries(filterObj).map(([key, val], i) => {
                params.push(val);
                return `"${key}" = ?`;
              });
              if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
            } catch {}
          }

          if (limit) query += ` LIMIT ${parseInt(limit) || 100}`;

          const rows = await prisma.$queryRawUnsafe(query, ...params);
          await prisma.$disconnect();
          return res.json({ success: true, data: rows });

        } else if (operation === 'insert') {
          let insertData: any = {};
          try { insertData = typeof data === 'string' ? JSON.parse(data) : (data || {}); } catch { insertData = { value: data }; }
          
          const keys = Object.keys(insertData);
          const placeholders = keys.map(() => '?').join(', ');
          const values = Object.values(insertData);
          const query = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders})`;
          
          await prisma.$executeRawUnsafe(query, ...values);
          await prisma.$disconnect();
          return res.json({ success: true, data: { inserted: true, table, data: insertData } });

        } else if (operation === 'update') {
          let updateData: any = {};
          let filterObj: any = {};
          try { updateData = typeof data === 'string' ? JSON.parse(data) : (data || {}); } catch {}
          try { filterObj = typeof filter === 'string' ? JSON.parse(filter) : (filter || {}); } catch {}

          const setClauses = Object.keys(updateData).map(k => `"${k}" = ?`);
          const whereConditions = Object.keys(filterObj).map(k => `"${k}" = ?`);
          const params = [...Object.values(updateData), ...Object.values(filterObj)];

          let query = `UPDATE "${table}" SET ${setClauses.join(', ')}`;
          if (whereConditions.length > 0) query += ` WHERE ${whereConditions.join(' AND ')}`;

          await prisma.$executeRawUnsafe(query, ...params);
          await prisma.$disconnect();
          return res.json({ success: true, data: { updated: true, table } });

        } else if (operation === 'delete') {
          let filterObj: any = {};
          try { filterObj = typeof filter === 'string' ? JSON.parse(filter) : (filter || {}); } catch {}

          const conditions = Object.keys(filterObj).map(k => `"${k}" = ?`);
          const params = Object.values(filterObj);

          let query = `DELETE FROM "${table}"`;
          if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;

          await prisma.$executeRawUnsafe(query, ...params);
          await prisma.$disconnect();
          return res.json({ success: true, data: { deleted: true, table } });
        }

        await prisma.$disconnect();
        return res.status(400).json({ success: false, error: `Unknown operation: ${operation}` });

      } catch (sqlErr: any) {
        try { await prisma.$disconnect(); } catch {}
        return res.status(500).json({ success: false, error: `SQLite Error: ${sqlErr.message}` });
      }
    }

    // PostgreSQL
    if (dbType === 'postgresql' && connectionString) {
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString });
      
      try {
        if (operation === 'select') {
          let query = `SELECT * FROM "${table}"`;
          const params: any[] = [];
          let paramIdx = 1;

          if (filter) {
            try {
              const filterObj = typeof filter === 'string' ? JSON.parse(filter) : filter;
              const conditions = Object.entries(filterObj).map(([key, val]) => {
                params.push(val);
                return `"${key}" = $${paramIdx++}`;
              });
              if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
            } catch {}
          }

          if (limit) query += ` LIMIT ${parseInt(limit) || 100}`;

          const result = await pool.query(query, params);
          await pool.end();
          return res.json({ success: true, data: result.rows });

        } else if (operation === 'insert') {
          let insertData: any = {};
          try { insertData = typeof data === 'string' ? JSON.parse(data) : (data || {}); } catch { insertData = { value: data }; }

          const keys = Object.keys(insertData);
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const values = Object.values(insertData);

          const query = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
          const result = await pool.query(query, values);
          await pool.end();
          return res.json({ success: true, data: result.rows[0] || { inserted: true } });
        }

        await pool.end();
        return res.status(400).json({ success: false, error: `Operation "${operation}" not fully implemented for PostgreSQL` });

      } catch (pgErr: any) {
        try { await pool.end(); } catch {}
        return res.status(500).json({ success: false, error: `PostgreSQL Error: ${pgErr.message}` });
      }
    }

    return res.status(400).json({ success: false, error: `Unsupported database type: ${dbType}. Supported: sqlite, postgresql` });

  } catch (error: any) {
    logger.error('Database execute error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Global Error Handler ---
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Server Error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    error: config.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// --- Server Start ---
const PORT = config.PORT || 8080;
app.listen(PORT, async () => {
  // Try to initialize job queue (optional - falls back to sync execution)
  try {
    await jobQueueService.initialize();
  } catch (e) {
    logger.warn('Job queue not initialized - using synchronous execution');
  }

  // Load scheduler active triggers from database on startup
  try {
    await schedulerService.initialize();
  } catch (e: any) {
    logger.error('Failed to initialize cron scheduler:', e.message);
  }

  // ===========================================
  // KEEP-ALIVE PING SERVICE (Render Free Tier)
  // Prevents spin-down after 15 minutes of inactivity
  // ===========================================
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
  const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes (under 15 min threshold)

  if (RENDER_URL && config.NODE_ENV === 'production') {
    const keepAlive = () => {
      axios.get(`${RENDER_URL}/health`)
        .then((res) => {
          logger.info(`[Keep-Alive] Ping successful at ${new Date().toISOString()} - Status: ${res.status}`);
        })
        .catch((err) => {
          logger.warn(`[Keep-Alive] Ping failed: ${err.message}`);
        });
    };

    // Initial ping after 1 minute, then every 10 minutes
    setTimeout(keepAlive, 60 * 1000);
    setInterval(keepAlive, PING_INTERVAL);
    
    logger.info(`[Keep-Alive] Service enabled - Pinging ${RENDER_URL}/health every 10 minutes`);
  }

  console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │  🚀 Aether Workflow Engine is running                     │
  │                                                          │
  │  ➜ Local:      http://localhost:${PORT}                      │
  │  ➜ API:        http://localhost:${PORT}/api/v1               │
  │  ➜ Webhooks:   http://localhost:${PORT}/webhook/...          │
  │  ➜ Env:        ${config.NODE_ENV}                               │
  │                                                          │
  │  Available Services:                                     │
  │    ✓ Workflow Execution Engine                           │
  │    ✓ Webhook Trigger Service                             │
  │    ✓ Cron Scheduler Service                              │
  │    ✓ Credential Management                               │
  │    ✓ AI Workflow Generator                               │
  │    ${jobQueueService.isAvailable() ? '✓' : '○'} Job Queue (BullMQ)                              │
  │    ${RENDER_URL ? '✓' : '○'} Keep-Alive Ping Service                          │
  └──────────────────────────────────────────────────────────┘
  `);
});

export default app;
