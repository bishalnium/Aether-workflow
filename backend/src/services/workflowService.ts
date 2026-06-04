// ===========================================
// AETHER WORKFLOW ENGINE - Workflow Service
// CRUD operations for workflows using Prisma
// ===========================================

import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';
import { WorkflowDefinition, WorkflowNode, WorkflowEdge } from '../types/workflow.types';
import { webhookService } from './webhookService';
import { schedulerService } from './schedulerService';
import prisma from '../utils/prismaClient';

interface StoredWorkflow extends WorkflowDefinition {
  userId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ExecutionRecord {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  mode: string;
  startedAt?: Date;
  finishedAt?: Date;
  input?: any;
  output?: any;
  error?: string;
  nodeResults?: any[];
}

// Helper: Ensure a valid user exists in PostgreSQL for this ID/email
async function ensureUser(userId: string): Promise<string> {
  if (userId.length === 36 && userId.includes('-')) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) return user.id;
  }

  const email = userId.includes('@') ? userId : `${userId}@aether.local`;
  const userByEmail = await prisma.user.findUnique({ where: { email } });
  if (userByEmail) return userByEmail.id;

  const newUser = await prisma.user.create({
    data: {
      email,
      name: email.split('@')[0] || 'User',
    }
  });
  logger.info(`Created placeholder user record: ${newUser.id} for ${userId}`);
  return newUser.id;
}

// Helper: Map Prisma Workflow model to StoredWorkflow interface
function mapDbWorkflow(dbW: any): StoredWorkflow {
  return {
    id: dbW.id,
    name: dbW.name,
    description: dbW.description || undefined,
    isActive: dbW.isActive,
    userId: dbW.userId,
    createdAt: dbW.createdAt,
    updatedAt: dbW.updatedAt,
    settings: dbW.settings ? (typeof dbW.settings === 'string' ? JSON.parse(dbW.settings) : dbW.settings) : undefined,
    nodes: (dbW.nodes || []).map((n: any) => ({
      id: n.nodeId,
      type: n.type,
      name: n.name,
      position: typeof n.position === 'string' ? JSON.parse(n.position) : n.position,
      config: typeof n.config === 'string' ? JSON.parse(n.config) : n.config,
      credentialId: n.credentials || undefined
    })),
    edges: (dbW.edges || []).map((e: any) => ({
      id: e.edgeId,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      condition: e.condition ? (typeof e.condition === 'string' ? JSON.parse(e.condition) : e.condition) : undefined
    }))
  };
}

// Helper: Map Prisma Execution model to ExecutionRecord interface
function mapDbExecution(dbE: any): ExecutionRecord {
  return {
    id: dbE.id,
    workflowId: dbE.workflowId,
    status: dbE.status.toLowerCase() as any,
    mode: dbE.mode.toLowerCase(),
    startedAt: dbE.startedAt || undefined,
    finishedAt: dbE.finishedAt || undefined,
    input: dbE.data,
    output: dbE.outputData || undefined,
    error: dbE.error || undefined,
    nodeResults: (dbE.nodeExecutions || []).map((ne: any) => ({
      nodeId: ne.nodeId,
      status: ne.status.toLowerCase() as any,
      startedAt: ne.startedAt || undefined,
      finishedAt: ne.finishedAt || undefined,
      data: ne.outputData,
      error: ne.error || undefined
    }))
  };
}

class WorkflowService {
  constructor() {
    logger.info('Workflow database service initialized');
  }

  /**
   * Create a new workflow in PostgreSQL
   */
  async create(
    userId: string,
    data: {
      id?: string;
      name: string;
      description?: string;
      nodes?: WorkflowNode[];
      edges?: WorkflowEdge[];
      settings?: WorkflowDefinition['settings'];
    }
  ): Promise<StoredWorkflow> {
    const dbUserId = await ensureUser(userId);
    const id = data.id || `wf_${uuid()}`;

    const nodes = (data.nodes || []).map(node => {
      if (node.config?.path && node.config.path.includes('/webhook/')) {
        return {
          ...node,
          config: {
            ...node.config,
            path: `/webhook/${id}/trigger`
          }
        };
      }
      return node;
    });

    const workflow = await prisma.workflow.create({
      data: {
        id,
        name: data.name,
        description: data.description || null,
        isActive: false,
        settings: data.settings ? (data.settings as any) : undefined,
        userId: dbUserId,
        nodes: {
          create: nodes.map(n => ({
            nodeId: n.id,
            type: n.type as any,
            name: n.name,
            position: n.position as any,
            config: n.config as any,
            credentials: n.credentialId || null
          }))
        },
        edges: {
          create: (data.edges || []).map(e => ({
            edgeId: e.id,
            sourceNodeId: e.source,
            targetNodeId: e.target,
            condition: e.condition ? (e.condition as any) : undefined
          }))
        }
      },
      include: {
        nodes: true,
        edges: true
      }
    });

    const mapped = mapDbWorkflow(workflow);
    
    await webhookService.registerWorkflow(mapped);
    await schedulerService.registerWorkflow(mapped);

    logger.info(`Workflow created in DB: ${id}`, { name: data.name, userId });
    return mapped;
  }

  /**
   * Get a workflow by ID
   */
  async get(workflowId: string, userId?: string): Promise<StoredWorkflow | null> {
    const dbUserId = userId ? await ensureUser(userId) : undefined;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        ...(dbUserId ? { userId: dbUserId } : {})
      },
      include: {
        nodes: true,
        edges: true
      }
    });

    if (!workflow) return null;
    return mapDbWorkflow(workflow);
  }

  /**
   * Update an existing workflow in PostgreSQL
   */
  async update(
    workflowId: string,
    userId: string,
    data: Partial<{
      name: string;
      description: string;
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
      settings: WorkflowDefinition['settings'];
      isActive: boolean;
    }>
  ): Promise<StoredWorkflow | null> {
    const dbUserId = await ensureUser(userId);
    
    const exists = await prisma.workflow.findFirst({
      where: { id: workflowId, userId: dbUserId }
    });
    if (!exists) return null;

    const updated = await prisma.$transaction(async (tx) => {
      if (data.nodes !== undefined) {
        await tx.workflowNode.deleteMany({ where: { workflowId } });
      }
      if (data.edges !== undefined) {
        await tx.workflowEdge.deleteMany({ where: { workflowId } });
      }

      return tx.workflow.update({
        where: { id: workflowId },
        data: {
          name: data.name,
          description: data.description,
          isActive: data.isActive,
          settings: data.settings ? (data.settings as any) : undefined,
          nodes: data.nodes ? {
            create: data.nodes.map(n => ({
              nodeId: n.id,
              type: n.type as any,
              name: n.name,
              position: n.position as any,
              config: n.config as any,
              credentials: n.credentialId || null
            }))
          } : undefined,
          edges: data.edges ? {
            create: data.edges.map(e => ({
              edgeId: e.id,
              sourceNodeId: e.source,
              targetNodeId: e.target,
              condition: e.condition ? (e.condition as any) : undefined
            }))
          } : undefined
        },
        include: {
          nodes: true,
          edges: true
        }
      });
    });

    const mapped = mapDbWorkflow(updated);
    
    await webhookService.registerWorkflow(mapped);
    await schedulerService.registerWorkflow(mapped);

    logger.info(`Workflow updated in DB: ${workflowId}`);
    return mapped;
  }

  /**
   * Delete a workflow
   */
  async delete(workflowId: string, userId: string): Promise<boolean> {
    const dbUserId = await ensureUser(userId);

    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId: dbUserId }
    });
    if (!workflow) return false;

    const webhooks = await webhookService.listByWorkflow(workflowId);
    for (const wh of webhooks) {
      await webhookService.delete(wh.id);
    }

    await prisma.workflow.delete({ where: { id: workflowId } });
    logger.info(`Workflow deleted from DB: ${workflowId}`);
    return true;
  }

  /**
   * List workflows for a user
   */
  async list(userId: string): Promise<StoredWorkflow[]> {
    const dbUserId = await ensureUser(userId);

    const workflows = await prisma.workflow.findMany({
      where: { userId: dbUserId },
      include: {
        nodes: true,
        edges: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    return workflows.map(mapDbWorkflow);
  }

  /**
   * Duplicate a workflow
   */
  async duplicate(workflowId: string, userId: string): Promise<StoredWorkflow | null> {
    const original = await this.get(workflowId, userId);
    if (!original) return null;

    return this.create(userId, {
      name: `${original.name} (Copy)`,
      description: original.description,
      nodes: original.nodes.map(n => ({ ...n, id: `${n.id}_copy` })),
      edges: original.edges.map(e => ({
        ...e,
        id: `${e.id}_copy`,
        source: `${e.source}_copy`,
        target: `${e.target}_copy`,
      })),
      settings: original.settings,
    });
  }

  /**
   * Export workflow
   */
  async export(workflowId: string, userId: string): Promise<object | null> {
    const workflow = await this.get(workflowId, userId);
    if (!workflow) return null;

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workflow: {
        name: workflow.name,
        description: workflow.description,
        nodes: workflow.nodes,
        edges: workflow.edges,
        settings: workflow.settings,
      },
    };
  }

  /**
   * Import workflow
   */
  async import(userId: string, data: any): Promise<StoredWorkflow | null> {
    if (!data.workflow) return null;

    return this.create(userId, {
      name: data.workflow.name || 'Imported Workflow',
      description: data.workflow.description,
      nodes: data.workflow.nodes || [],
      edges: data.workflow.edges || [],
      settings: data.workflow.settings,
    });
  }

  /**
   * Record a workflow execution
   */
  async recordExecution(data: ExecutionRecord): Promise<void> {
    const exists = await prisma.workflow.findUnique({ where: { id: data.workflowId } });
    if (!exists) {
      logger.warn(`Cannot record execution: Workflow ${data.workflowId} not found in DB`);
      return;
    }

    const prismaStatus = data.status.toUpperCase() as any;
    const prismaMode = data.mode.toUpperCase() as any;

    await prisma.workflowExecution.create({
      data: {
        id: data.id,
        workflowId: data.workflowId,
        status: prismaStatus,
        mode: prismaMode,
        startedAt: data.startedAt || new Date(),
        finishedAt: data.finishedAt || null,
        error: data.error || null,
        data: data.input || null,
        nodeExecutions: {
          create: (data.nodeResults || []).map(nr => ({
            nodeId: nr.nodeId,
            nodeName: nr.nodeId,
            status: nr.status.toUpperCase() as any,
            startedAt: nr.startedAt,
            finishedAt: nr.finishedAt,
            outputData: nr.data || null,
            error: nr.error || null
          }))
        }
      }
    });

    logger.debug(`Execution recorded in DB: ${data.id}`);
  }

  /**
   * Update an existing execution
   */
  async updateExecution(executionId: string, updates: Partial<ExecutionRecord>): Promise<void> {
    const existing = await prisma.workflowExecution.findUnique({ where: { id: executionId } });
    if (!existing) return;

    const data: any = {};
    if (updates.status) data.status = updates.status.toUpperCase();
    if (updates.finishedAt) data.finishedAt = updates.finishedAt;
    if (updates.output) data.outputData = updates.output;
    if (updates.error) data.error = updates.error;

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data
    });

    if (updates.nodeResults) {
      for (const nr of updates.nodeResults) {
        await prisma.nodeExecution.updateMany({
          where: { executionId, nodeId: nr.nodeId },
          data: {
            status: nr.status.toUpperCase() as any,
            startedAt: nr.startedAt || undefined,
            finishedAt: nr.finishedAt || undefined,
            outputData: nr.data || undefined,
            error: nr.error || null
          }
        });
      }
    }
  }

  /**
   * Get execution history for a workflow
   */
  async getExecutions(workflowId: string, limit: number = 50): Promise<ExecutionRecord[]> {
    const executions = await prisma.workflowExecution.findMany({
      where: { workflowId },
      include: { nodeExecutions: true },
      orderBy: { startedAt: 'desc' },
      take: limit
    });

    return executions.map(mapDbExecution);
  }

  /**
   * Get a single execution
   */
  async getExecution(executionId: string): Promise<ExecutionRecord | null> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { nodeExecutions: true }
    });

    if (!execution) return null;
    return mapDbExecution(execution);
  }

  /**
   * Get workflow statistics
   */
  async getStats(userId: string): Promise<{
    totalWorkflows: number;
    activeWorkflows: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
  }> {
    const dbUserId = await ensureUser(userId);

    const workflows = await prisma.workflow.findMany({
      where: { userId: dbUserId },
      select: { id: true, isActive: true }
    });

    const workflowIds = workflows.map(w => w.id);

    const totalExecutions = await prisma.workflowExecution.count({
      where: { workflowId: { in: workflowIds } }
    });

    const successfulExecutions = await prisma.workflowExecution.count({
      where: { workflowId: { in: workflowIds }, status: 'SUCCESS' }
    });

    const failedExecutions = await prisma.workflowExecution.count({
      where: { workflowId: { in: workflowIds }, status: 'FAILED' }
    });

    return {
      totalWorkflows: workflows.length,
      activeWorkflows: workflows.filter(w => w.isActive).length,
      totalExecutions,
      successfulExecutions,
      failedExecutions
    };
  }
}

export const workflowService = new WorkflowService();
export default workflowService;
