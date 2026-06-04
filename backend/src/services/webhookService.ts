// ===========================================
// AETHER WORKFLOW ENGINE - Webhook Service
// HTTP webhook handling and database registration
// ===========================================

import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';
import { encryption } from '../utils/encryption';
import { WorkflowDefinition, WebhookPayload } from '../types/workflow.types';
import { executeWorkflow } from '../engine/executionEngine';
import prisma from '../utils/prismaClient';

interface RegisteredWebhook {
  id: string;
  path: string;
  workflowId: string;
  method: string;
  isActive: boolean;
  responseMode: 'onReceived' | 'onCompleted'; // Async vs Sync
  authType: 'none' | 'basic' | 'header' | 'jwt';
  authConfig?: {
    username?: string;
    passwordHash?: string;
    headerName?: string;
    headerValueHash?: string;
    jwtSecret?: string;
  };
  createdAt: Date;
}

class WebhookService {
  constructor() {
    logger.info('Webhook database service initialized');
  }

  /**
   * Register a workflow for the service to access
   * Also auto-registers any webhook trigger nodes found in the workflow
   */
  async registerWorkflow(workflow: WorkflowDefinition): Promise<void> {
    const webhookNodes = workflow.nodes.filter(n => {
      const nodeType = String(n.type).toUpperCase();
      return (
        nodeType === 'TRIGGER_WEBHOOK' || 
        nodeType === 'TRIGGER' || 
        nodeType.includes('WEBHOOK') ||
        n.config?.model === 'webhook-trigger' ||
        (n.name && n.name.toLowerCase().includes('webhook'))
      );
    });
    
    // If no explicit webhook nodes, register the workflow itself as a webhook target
    if (webhookNodes.length === 0 && workflow.nodes.length > 0) {
      const defaultPath = `/webhook/${workflow.id}/trigger`;
      try {
        await this.register(workflow.id, {
          path: defaultPath,
          method: 'ANY',
          authType: 'none'
        });
        logger.info(`Auto-registered default webhook for workflow ${workflow.id}: ${defaultPath}`);
      } catch (e: any) {
        logger.warn(`Failed to register default webhook for workflow ${workflow.id}: ${e.message}`);
      }
      return;
    }
    
    for (const node of webhookNodes) {
      const path = node.config?.path || `/webhook/${workflow.id}/trigger`;
      const method = node.config?.method || node.config?.httpMethod || 'ANY';
      
      try {
        await this.register(workflow.id, {
          path,
          method,
          authType: node.config?.authentication || node.config?.authType || 'none',
          authConfig: node.config?.authConfig
        });
        logger.info(`Auto-registered webhook for workflow ${workflow.id}: ${path}`);
      } catch (e: any) {
        logger.warn(`Failed to auto-register webhook for workflow ${workflow.id}: ${e.message}`);
      }
    }
  }

  /**
   * Register a new webhook endpoint in the database
   */
  async register(
    workflowId: string,
    options: {
      path?: string;
      method?: string;
      authType?: string;
      authConfig?: {
        username?: string;
        password?: string;
        headerName?: string;
        headerValue?: string;
        jwtSecret?: string;
      };
    } = {}
  ): Promise<RegisteredWebhook> {
    const path = options.path || `/webhook/wh_${uuid()}`;
    const method = options.method?.toUpperCase() || 'ANY';
    const authType = (options.authType || 'none') as any;

    const dbAuthConfig: any = {};
    if (options.authConfig) {
      if (options.authConfig.username) {
        dbAuthConfig.username = options.authConfig.username;
        dbAuthConfig.passwordHash = encryption.hash(options.authConfig.password || '');
      }
      if (options.authConfig.headerName) {
        dbAuthConfig.headerName = options.authConfig.headerName;
        dbAuthConfig.headerValueHash = encryption.hash(options.authConfig.headerValue || '');
      }
      if (options.authConfig.jwtSecret) {
        dbAuthConfig.jwtSecret = options.authConfig.jwtSecret;
      }
    }

    const trigger = await prisma.webhookTrigger.upsert({
      where: { path },
      update: {
        method,
        authType,
        authConfig: dbAuthConfig,
        workflowId
      },
      create: {
        id: `wh_${uuid()}`,
        path,
        method,
        authType,
        authConfig: dbAuthConfig,
        workflowId
      }
    });

    logger.info(`Registered webhook in DB: ${path}`, { webhookId: trigger.id, workflowId });
    
    return {
      id: trigger.id,
      path: trigger.path,
      workflowId: trigger.workflowId,
      method: trigger.method,
      isActive: trigger.isActive,
      responseMode: 'onCompleted',
      authType: trigger.authType as any,
      authConfig: trigger.authConfig as any,
      createdAt: trigger.createdAt
    };
  }

  /**
   * Handle incoming webhook request
   */
  async handleRequest(payload: WebhookPayload): Promise<{
    success: boolean;
    executionId?: string;
    response?: any;
    error?: string;
  }> {
    const { path, method, headers, body } = payload;

    // Find matching webhook in DB and load its associated workflow
    const webhook = await prisma.webhookTrigger.findUnique({
      where: { path },
      include: {
        workflow: {
          include: {
            nodes: true,
            edges: true
          }
        }
      }
    });

    if (!webhook) {
      logger.warn(`Webhook not found: ${path}`);
      return { success: false, error: 'Webhook not found' };
    }

    // Check if active
    if (!webhook.isActive) {
      return { success: false, error: 'Webhook is disabled' };
    }

    // Verify method
    if (webhook.method !== 'ANY' && webhook.method !== method.toUpperCase()) {
      return { success: false, error: `Method not allowed. Expected ${webhook.method}` };
    }

    // Authenticate
    const authResult = this.authenticate(webhook, headers);
    if (!authResult.success) {
      logger.warn(`Webhook auth failed: ${path}`, { reason: authResult.error });
      return { success: false, error: 'Authentication failed' };
    }

    const workflow = webhook.workflow;
    if (!workflow) {
      logger.error(`Workflow not found for webhook: ${webhook.workflowId}`);
      return { success: false, error: 'Workflow not found' };
    }

    // Map Prisma Workflow model nodes and edges to frontend format expected by the execution engine
    const nodes = (workflow.nodes || []).map((n: any) => ({
      id: n.nodeId,
      type: n.type,
      name: n.name,
      position: typeof n.position === 'string' ? JSON.parse(n.position) : n.position,
      config: typeof n.config === 'string' ? JSON.parse(n.config) : n.config,
      credentialId: n.credentials || undefined
    }));

    const edges = (workflow.edges || []).map((e: any) => ({
      id: e.edgeId,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      condition: e.condition ? (typeof e.condition === 'string' ? JSON.parse(e.condition) : e.condition) : undefined
    }));

    const mappedWorkflow: WorkflowDefinition = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description || undefined,
      settings: workflow.settings ? (typeof workflow.settings === 'string' ? JSON.parse(workflow.settings) : workflow.settings) : undefined,
      nodes,
      edges
    };

    logger.info(`Webhook triggered: ${path}`, { webhookId: webhook.id, workflowId: webhook.workflowId });

    try {
      const result = await executeWorkflow(
        mappedWorkflow,
        {
          webhook: {
            path,
            method,
            headers,
            query: payload.query,
            body,
            timestamp: payload.timestamp,
          },
          body,
          query: payload.query,
        },
        undefined,
        'webhook'
      );

      // Save execution history in PostgreSQL asynchronously
      const executionId = result.executionId;
      const prismaStatus = result.status.toUpperCase() as any;
      
      await prisma.workflowExecution.create({
        data: {
          id: executionId,
          workflowId: workflow.id,
          status: prismaStatus,
          mode: 'WEBHOOK',
          startedAt: new Date(),
          finishedAt: new Date(),
          error: result.error || null,
          data: body || null,
          nodeExecutions: {
            create: (result.results || []).map(r => ({
              nodeId: r.nodeId,
              nodeName: r.nodeId,
              status: r.status.toUpperCase() as any,
              startedAt: r.startedAt,
              finishedAt: r.finishedAt,
              outputData: r.data || null,
              error: r.error || null
            }))
          }
        }
      });

      if (result.status === 'failed') {
        return { success: false, error: result.error || 'Execution failed', executionId };
      }

      // Extract the response
      const output = result.output;
      const aiResponse = output?.aiResponse || output?.response || output?.answer || output?.output || output;
      
      return {
        success: true,
        executionId,
        response: aiResponse,
      };
    } catch (error: any) {
      logger.error(`Webhook execution failed: ${path}`, { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Authenticate webhook request
   */
  private authenticate(
    webhook: any,
    headers: Record<string, string>
  ): { success: boolean; error?: string } {
    if (!webhook.authType || webhook.authType === 'none') {
      return { success: true };
    }

    const authConfig = webhook.authConfig as any;

    switch (webhook.authType) {
      case 'basic': {
        const authHeader = headers['authorization'] || headers['Authorization'];
        if (!authHeader?.startsWith('Basic ')) {
          return { success: false, error: 'Missing Basic auth' };
        }
        
        const base64 = authHeader.substring(6);
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        const [username, password] = decoded.split(':');
        
        if (username !== authConfig?.username) {
          return { success: false, error: 'Invalid username' };
        }
        
        if (encryption.hash(password) !== authConfig?.passwordHash) {
          return { success: false, error: 'Invalid password' };
        }
        
        return { success: true };
      }

      case 'header': {
        const headerName = authConfig?.headerName || 'X-Webhook-Secret';
        const headerValue = headers[headerName] || headers[headerName.toLowerCase()];
        
        if (!headerValue) {
          return { success: false, error: `Missing header: ${headerName}` };
        }
        
        if (encryption.hash(headerValue) !== authConfig?.headerValueHash) {
          return { success: false, error: 'Invalid header value' };
        }
        
        return { success: true };
      }

      case 'jwt':
        const token = headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return { success: false, error: 'Missing JWT token' };
        }
        return { success: true };

      default:
        return { success: true };
    }
  }

  /**
   * Get webhook by ID
   */
  async get(webhookId: string): Promise<RegisteredWebhook | null> {
    const trigger = await prisma.webhookTrigger.findUnique({ where: { id: webhookId } });
    if (!trigger) return null;
    return {
      id: trigger.id,
      path: trigger.path,
      workflowId: trigger.workflowId,
      method: trigger.method,
      isActive: trigger.isActive,
      responseMode: 'onCompleted',
      authType: trigger.authType as any,
      authConfig: trigger.authConfig as any,
      createdAt: trigger.createdAt
    };
  }

  /**
   * Get webhook by path
   */
  async getByPath(path: string): Promise<RegisteredWebhook | null> {
    const trigger = await prisma.webhookTrigger.findUnique({
      where: { path },
      include: { workflow: { include: { nodes: true } } }
    });
    if (!trigger) return null;

    const nodes = (trigger.workflow?.nodes || []).map((n: any) => ({
      type: n.type,
      config: typeof n.config === 'string' ? JSON.parse(n.config) : n.config
    }));
    const triggerNode = nodes.find(n => String(n.type).toUpperCase() === 'TRIGGER_WEBHOOK' || n.type.startsWith('TRIGGER'));
    const responseMode = triggerNode?.config?.responseMode || 'onCompleted';

    return {
      id: trigger.id,
      path: trigger.path,
      workflowId: trigger.workflowId,
      method: trigger.method,
      isActive: trigger.isActive,
      responseMode: responseMode as any,
      authType: trigger.authType as any,
      authConfig: trigger.authConfig as any,
      createdAt: trigger.createdAt
    };
  }

  /**
   * List all webhooks for a workflow
   */
  async listByWorkflow(workflowId: string): Promise<RegisteredWebhook[]> {
    const triggers = await prisma.webhookTrigger.findMany({ where: { workflowId } });
    return triggers.map(trigger => ({
      id: trigger.id,
      path: trigger.path,
      workflowId: trigger.workflowId,
      method: trigger.method,
      isActive: trigger.isActive,
      responseMode: 'onCompleted',
      authType: trigger.authType as any,
      authConfig: trigger.authConfig as any,
      createdAt: trigger.createdAt
    }));
  }

  /**
   * Toggle webhook active state
   */
  async toggle(webhookId: string): Promise<boolean> {
    const trigger = await prisma.webhookTrigger.findUnique({ where: { id: webhookId } });
    if (!trigger) return false;
    
    const updated = await prisma.webhookTrigger.update({
      where: { id: webhookId },
      data: { isActive: !trigger.isActive }
    });

    logger.info(`Webhook ${updated.isActive ? 'enabled' : 'disabled'}: ${webhookId}`);
    return true;
  }

  /**
   * Delete a webhook
   */
  async delete(webhookId: string): Promise<boolean> {
    const trigger = await prisma.webhookTrigger.findUnique({ where: { id: webhookId } });
    if (!trigger) return false;

    await prisma.webhookTrigger.delete({ where: { id: webhookId } });
    logger.info(`Deleted webhook: ${webhookId}`);
    return true;
  }

  /**
   * Get all registered paths
   */
  async getAllPaths(): Promise<string[]> {
    const triggers = await prisma.webhookTrigger.findMany({ select: { path: true } });
    return triggers.map(t => t.path);
  }
}

export const webhookService = new WebhookService();
export default webhookService;
