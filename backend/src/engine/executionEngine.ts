// ===========================================
// AETHER WORKFLOW ENGINE - Execution Engine
// The core runtime that executes workflow graphs
// ===========================================

import { v4 as uuid } from 'uuid';
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  ExecutionContext,
  NodeExecutionResult,
  NodeType,
} from '../types/workflow.types';
import { nodeHandlerRegistry } from './nodeHandlers';
import { logger } from '../utils/logger';

export class WorkflowExecutionEngine {
  private workflow: WorkflowDefinition;
  private context: ExecutionContext;
  private executedNodes: Set<string> = new Set();
  private nodeResults: Map<string, NodeExecutionResult> = new Map();

  constructor(workflow: WorkflowDefinition, input?: any, userId?: string, mode: ExecutionContext['mode'] = 'manual') {
    this.workflow = workflow;
    this.context = {
      executionId: uuid(),
      workflowId: workflow.id,
      userId,
      mode,
      startedAt: new Date(),
      input,
      nodeOutputs: new Map(),
      variables: {},
      credentials: new Map(),
    };
  }

  getExecutionId(): string {
    return this.context.executionId;
  }

  getContext(): ExecutionContext {
    return this.context;
  }

  /**
   * Execute the entire workflow
   */
  async execute(): Promise<{
    executionId: string;
    status: 'success' | 'failed';
    results: NodeExecutionResult[];
    output?: any;
    error?: string;
  }> {
    logger.info(`Starting workflow execution: ${this.workflow.id}`, {
      executionId: this.context.executionId,
    });

    try {
      // Find trigger/start nodes (nodes with no incoming edges)
      const startNodes = this.findStartNodes();
      
      if (startNodes.length === 0) {
        throw new Error('No trigger or start node found in workflow');
      }

      // Set initial input for trigger nodes
      if (this.context.input) {
        for (const node of startNodes) {
          this.context.nodeOutputs.set(node.id, this.context.input);
        }
      }

      // Execute from each start node
      for (const startNode of startNodes) {
        await this.executeNode(startNode);
      }

      // Find the final output (nodes with no outgoing edges)
      const endNodes = this.findEndNodes();
      let finalOutput: any;
      
      if (endNodes.length > 0) {
        finalOutput = this.context.nodeOutputs.get(endNodes[endNodes.length - 1].id);
      }

      logger.info(`Workflow execution completed: ${this.workflow.id}`, {
        executionId: this.context.executionId,
        nodesExecuted: this.executedNodes.size,
      });

      return {
        executionId: this.context.executionId,
        status: 'success',
        results: Array.from(this.nodeResults.values()),
        output: finalOutput,
      };
    } catch (error: any) {
      logger.error(`Workflow execution failed: ${this.workflow.id}`, {
        executionId: this.context.executionId,
        error: error.message,
      });

      return {
        executionId: this.context.executionId,
        status: 'failed',
        results: Array.from(this.nodeResults.values()),
        error: error.message,
      };
    }
  }

  /**
   * Execute a single node and its downstream nodes
   */
  private async executeNode(node: WorkflowNode): Promise<void> {
    // Skip if already executed
    if (this.executedNodes.has(node.id)) {
      return;
    }

    // Check if all upstream nodes have executed
    const incomingEdges = this.getIncomingEdges(node.id);
    for (const edge of incomingEdges) {
      if (!this.executedNodes.has(edge.source)) {
        // Upstream node not yet executed, skip for now
        return;
      }
    }

    const startedAt = new Date();
    let result: NodeExecutionResult;

    try {
      // Gather input from upstream nodes
      const input = this.gatherNodeInput(node.id);

      logger.debug(`Executing node: ${node.name} (${node.type})`, {
        nodeId: node.id,
        executionId: this.context.executionId,
      });

      // Get handler for this node type
      const handler = nodeHandlerRegistry.getHandler(node.type);
      
      if (!handler) {
        throw new Error(`No handler registered for node type: ${node.type}`);
      }

      // Execute the node with up to 3 attempts
      let output: any;
      const maxAttempts = 3;
      let lastError: any;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          output = await handler(node, input, this.context);
          lastError = null;
          break; // Success!
        } catch (err: any) {
          lastError = err;
          logger.warn(`Node execution attempt ${attempt}/${maxAttempts} failed for "${node.name}" (${node.id}): ${err.message}`, {
            nodeId: node.id,
            executionId: this.context.executionId,
            attempt
          });
          if (attempt < maxAttempts) {
            const delay = 1000 * attempt;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (lastError) {
        throw lastError;
      }

      // Store the output
      this.context.nodeOutputs.set(node.id, output);

      result = {
        nodeId: node.id,
        status: 'success',
        data: output,
        startedAt,
        finishedAt: new Date(),
      };

      logger.debug(`Node executed successfully: ${node.name}`, {
        nodeId: node.id,
        executionId: this.context.executionId,
      });
    } catch (error: any) {
      result = {
        nodeId: node.id,
        status: 'error',
        error: error.message,
        startedAt,
        finishedAt: new Date(),
      };

      logger.error(`Node execution failed: ${node.name}`, {
        nodeId: node.id,
        executionId: this.context.executionId,
        error: error.message,
      });

      // Re-throw if workflow should stop on error
      if (this.workflow.settings?.errorHandling !== 'continue') {
        throw error;
      }
    }

    this.executedNodes.add(node.id);
    this.nodeResults.set(node.id, result);

    // Check if the node explicitly decided not to pass execution forward (e.g. RAG validator)
    if (result.status === 'success' && result.data && result.data.passForward === false) {
      logger.info(`[ENGINE] Node "${node.name}" (${node.id}) decided not to pass execution forward (passForward: false). Path stopped.`);
      return;
    }

    // Execute downstream nodes
    const outgoingEdges = this.getOutgoingEdges(node.id);
    
    for (const edge of outgoingEdges) {
      // Check edge conditions if any
      if (edge.condition && !this.evaluateCondition(edge.condition, result.data)) {
        continue;
      }

      const nextNode = this.workflow.nodes.find(n => n.id === edge.target);
      if (nextNode) {
        await this.executeNode(nextNode);
      }
    }
  }

  /**
   * Find nodes with no incoming edges (start nodes)
   */
  private findStartNodes(): WorkflowNode[] {
    const nodesWithIncoming = new Set(this.workflow.edges.map(e => e.target));
    return this.workflow.nodes.filter(n => 
      !nodesWithIncoming.has(n.id) || n.type.startsWith('TRIGGER_')
    );
  }

  /**
   * Find nodes with no outgoing edges (end nodes)
   */
  private findEndNodes(): WorkflowNode[] {
    const nodesWithOutgoing = new Set(this.workflow.edges.map(e => e.source));
    return this.workflow.nodes.filter(n => !nodesWithOutgoing.has(n.id));
  }

  /**
   * Get all edges coming into a node
   */
  private getIncomingEdges(nodeId: string): WorkflowEdge[] {
    return this.workflow.edges.filter(e => e.target === nodeId);
  }

  /**
   * Get all edges going out of a node
   */
  private getOutgoingEdges(nodeId: string): WorkflowEdge[] {
    return this.workflow.edges.filter(e => e.source === nodeId);
  }

  /**
   * Gather input data from all upstream nodes
   */
  private gatherNodeInput(nodeId: string): any {
    const incomingEdges = this.getIncomingEdges(nodeId);
    
    if (incomingEdges.length === 0) {
      return this.context.input || {};
    }

    if (incomingEdges.length === 1) {
      return this.context.nodeOutputs.get(incomingEdges[0].source) || {};
    }

    // Multiple inputs - merge them
    const mergedInput: any = {};
    for (const edge of incomingEdges) {
      const output = this.context.nodeOutputs.get(edge.source);
      if (output && typeof output === 'object') {
        Object.assign(mergedInput, output);
      }
    }
    return mergedInput;
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: WorkflowEdge['condition'], data: any): boolean {
    if (!condition) return true;

    const { field, operator, value } = condition;
    const fieldValue = this.getNestedValue(data, field);

    switch (operator) {
      case 'eq':
        return fieldValue === value;
      case 'neq':
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
      case 'regex':
        return new RegExp(value).test(String(fieldValue));
      default:
        return true;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }
}

/**
 * Factory function to create and execute a workflow
 */
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  input?: any,
  userId?: string,
  mode?: ExecutionContext['mode']
) {
  const engine = new WorkflowExecutionEngine(workflow, input, userId, mode);
  return engine.execute();
}
