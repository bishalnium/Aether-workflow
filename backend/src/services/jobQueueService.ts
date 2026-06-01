// ===========================================
// AETHER WORKFLOW ENGINE - Job Queue Service
// BullMQ-based async job processing
// Redis is OPTIONAL - falls back to sync execution
// ===========================================

import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';
import { WorkflowDefinition, JobPayload } from '../types/workflow.types';
import { executeWorkflow } from '../engine/executionEngine';

// BullMQ types - dynamically loaded
type Queue = any;
type Worker = any;
type Job = any;
type QueueEvents = any;

// Redis connection config
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) return null; // Stop retrying after 3 attempts
    return Math.min(times * 100, 1000);
  },
};

// Job queues
const QUEUE_NAME = 'aether-workflows';

// Check if Redis is enabled via environment
const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';

class JobQueueService {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private queueEvents: QueueEvents | null = null;
  private workflowStore: Map<string, WorkflowDefinition> = new Map();
  private isInitialized: boolean = false;
  private bullmq: any = null;

  constructor() {
    // Don't auto-initialize - Redis might not be available
    logger.info('Job queue service created (Redis enabled: ' + REDIS_ENABLED + ')');
  }

  /**
   * Initialize the job queue (requires Redis)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (!REDIS_ENABLED) {
      logger.info('Job queue disabled (REDIS_ENABLED not set to true)');
      return;
    }

    try {
      // Dynamically import BullMQ only if Redis is enabled
      this.bullmq = await import('bullmq');
      
      // Create queue
      this.queue = new this.bullmq.Queue(QUEUE_NAME, {
        connection: REDIS_CONFIG,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            age: 86400, // Keep completed jobs for 24 hours
            count: 1000,
          },
          removeOnFail: {
            age: 604800, // Keep failed jobs for 7 days
          },
        },
      });

      // Create worker
      this.worker = new this.bullmq.Worker(
        QUEUE_NAME,
        async (job: Job) => {
          return this.processJob(job);
        },
        {
          connection: REDIS_CONFIG,
          concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
        }
      );

      // Set up event handlers
      this.worker.on('completed', (job: any) => {
        logger.info(`Job completed: ${job.id}`, { workflowId: job.data.workflowId });
      });

      this.worker.on('failed', (job: any, err: any) => {
        logger.error(`Job failed: ${job?.id}`, {
          workflowId: job?.data.workflowId,
          error: err.message,
        });
      });

      // Queue events for monitoring
      this.queueEvents = new this.bullmq.QueueEvents(QUEUE_NAME, {
        connection: REDIS_CONFIG,
      });

      this.isInitialized = true;
      logger.info('Job queue service initialized', { queue: QUEUE_NAME });
    } catch (error: any) {
      logger.warn('Failed to initialize job queue (Redis may not be available)', {
        error: error.message,
      });
    }
  }

  /**
   * Register a workflow for the queue to access
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflowStore.set(workflow.id, workflow);
  }

  /**
   * Add a job to the queue
   */
  async enqueue(
    workflowId: string,
    input?: any,
    options?: {
      userId?: string;
      mode?: JobPayload['mode'];
      priority?: number;
      delay?: number;
      jobId?: string;
    }
  ): Promise<string> {
    const jobId = options?.jobId || `job_${uuid()}`;
    const executionId = `exec_${uuid()}`;

    const payload: JobPayload = {
      workflowId,
      executionId,
      input,
      userId: options?.userId,
      mode: options?.mode || 'manual',
    };

    if (this.queue) {
      await this.queue.add(workflowId, payload, {
        jobId,
        priority: options?.priority,
        delay: options?.delay,
      });

      logger.info(`Job enqueued: ${jobId}`, { workflowId, executionId });
    } else {
      // Fallback: execute synchronously if queue not available
      logger.warn('Queue not available, executing synchronously');
      await this.executeDirect(payload);
    }

    return executionId;
  }

  /**
   * Process a job from the queue
   */
  private async processJob(job: any): Promise<any> {
    const { workflowId, executionId, input, userId, mode } = job.data;

    logger.info(`Processing job: ${job.id}`, { workflowId, executionId, attempt: job.attemptsMade + 1 });

    const workflow = this.workflowStore.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const result = await executeWorkflow(workflow, input, userId, mode);

    if (result.status === 'failed') {
      throw new Error(result.error || 'Workflow execution failed');
    }

    return result;
  }

  /**
   * Direct execution fallback (when Redis not available)
   */
  private async executeDirect(payload: JobPayload): Promise<any> {
    const workflow = this.workflowStore.get(payload.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${payload.workflowId}`);
    }

    return executeWorkflow(workflow, payload.input, payload.userId, payload.mode);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    state: string;
    progress: number;
    data?: any;
    error?: string;
  } | null> {
    if (!this.queue) return null;

    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
      state,
      progress: job.progress as number || 0,
      data: job.returnvalue,
      error: job.failedReason,
    };
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  } | null> {
    if (!this.queue) return null;

    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
    };
  }

  /**
   * Retry a failed job
   */
  async retry(jobId: string): Promise<boolean> {
    if (!this.queue) return false;

    const job = await this.queue.getJob(jobId);
    if (!job) return false;

    await job.retry();
    logger.info(`Job retry requested: ${jobId}`);
    return true;
  }

  /**
   * Cancel a pending/delayed job
   */
  async cancel(jobId: string): Promise<boolean> {
    if (!this.queue) return false;

    const job = await this.queue.getJob(jobId);
    if (!job) return false;

    await job.remove();
    logger.info(`Job cancelled: ${jobId}`);
    return true;
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    if (this.queue) {
      await this.queue.pause();
      logger.info('Job queue paused');
    }
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    if (this.queue) {
      await this.queue.resume();
      logger.info('Job queue resumed');
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanup(olderThan: number = 86400000): Promise<void> {
    if (!this.queue) return;

    await this.queue.clean(olderThan, 1000, 'completed');
    await this.queue.clean(olderThan * 7, 1000, 'failed');
    logger.info('Job queue cleaned');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    logger.info('Job queue service shut down');
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.queue !== null;
  }
}

export const jobQueueService = new JobQueueService();
export default jobQueueService;
