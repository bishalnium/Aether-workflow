// ===========================================
// AETHER WORKFLOW ENGINE - Scheduler Service
// Cron-based workflow scheduling with DB persistence
// ===========================================

import * as cron from 'node-cron';
import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';
import { WorkflowDefinition } from '../types/workflow.types';
import { executeWorkflow } from '../engine/executionEngine';
import prisma from '../utils/prismaClient';
import { workflowService } from './workflowService';

interface ScheduledJob {
  id: string;
  workflowId: string;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  task: ReturnType<typeof cron.schedule>;
}

class SchedulerService {
  private jobs: Map<string, ScheduledJob> = new Map();

  constructor() {
    logger.info('Scheduler database service initialized');
  }

  /**
   * Initialize and load all active schedules from PostgreSQL on startup
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing scheduler: loading active schedules from PostgreSQL...');
      
      // Stop any running schedules first
      for (const [id, job] of this.jobs.entries()) {
        job.task.stop();
      }
      this.jobs.clear();

      const activeTriggers = await prisma.scheduleTrigger.findMany({
        where: { isActive: true }
      });

      for (const trigger of activeTriggers) {
        const task = cron.schedule(
          trigger.cronExpr,
          async () => {
            await this.executeScheduledWorkflow(trigger.id);
          },
          {
            timezone: trigger.timezone,
          }
        );

        this.jobs.set(trigger.id, {
          id: trigger.id,
          workflowId: trigger.workflowId,
          cronExpression: trigger.cronExpr,
          timezone: trigger.timezone,
          isActive: trigger.isActive,
          lastRunAt: trigger.lastRunAt || undefined,
          nextRunAt: trigger.nextRunAt || undefined,
          task
        });

        logger.info(`Re-scheduled workflow: ${trigger.workflowId} on startup (Cron: ${trigger.cronExpr})`);
      }

      logger.info(`Scheduler initialized successfully. Registered ${activeTriggers.length} active jobs.`);
    } catch (e: any) {
      logger.error('Failed to initialize cron scheduler from database:', e.message);
    }
  }

  /**
   * Register workflow (stub kept for compatibility)
   */
  async registerWorkflow(workflow: WorkflowDefinition): Promise<void> {
    // Dynamically query database instead of holding in-memory store
  }

  /**
   * Schedule a workflow to run on a cron schedule
   */
  async schedule(
    workflowId: string,
    cronExpression: string,
    timezone: string = 'UTC'
  ): Promise<string> {
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    const jobId = `schedule_${uuid()}`;

    // Create schedule in database
    await prisma.scheduleTrigger.create({
      data: {
        id: jobId,
        cronExpr: cronExpression,
        timezone,
        isActive: true,
        workflowId
      }
    });

    const task = cron.schedule(
      cronExpression,
      async () => {
        await this.executeScheduledWorkflow(jobId);
      },
      {
        timezone,
      }
    );

    const job: ScheduledJob = {
      id: jobId,
      workflowId,
      cronExpression,
      timezone,
      isActive: true,
      task,
    };

    job.nextRunAt = this.getNextRunTime(cronExpression);
    this.jobs.set(jobId, job);

    logger.info(`Scheduled workflow in DB: ${workflowId}`, {
      jobId,
      cronExpression,
      timezone,
      nextRun: job.nextRunAt,
    });

    return jobId;
  }

  /**
   * Execute a scheduled workflow
   */
  private async executeScheduledWorkflow(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || !job.isActive) return;

    const workflow = await workflowService.get(job.workflowId);
    if (!workflow) {
      logger.error(`Scheduled workflow not found: ${job.workflowId}`);
      return;
    }

    logger.info(`Executing scheduled workflow: ${job.workflowId}`, { jobId });

    try {
      const result = await executeWorkflow(
        workflow,
        { scheduledTime: new Date().toISOString() },
        undefined,
        'schedule'
      );

      const runDate = new Date();
      const nextRun = this.getNextRunTime(job.cronExpression);

      job.lastRunAt = runDate;
      job.nextRunAt = nextRun;

      // Update schedule record in DB
      await prisma.scheduleTrigger.update({
        where: { id: jobId },
        data: {
          lastRunAt: runDate,
          nextRunAt: nextRun
        }
      });

      // Save execution logs
      const prismaStatus = result.status.toUpperCase() as any;
      await prisma.workflowExecution.create({
        data: {
          id: result.executionId,
          workflowId: workflow.id,
          status: prismaStatus,
          mode: 'SCHEDULE',
          startedAt: runDate,
          finishedAt: new Date(),
          error: result.error || null,
          data: { scheduledTime: runDate.toISOString() },
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

      logger.info(`Scheduled workflow completed: ${job.workflowId}`, {
        jobId,
        status: result.status,
        executionId: result.executionId,
      });
    } catch (error: any) {
      logger.error(`Scheduled workflow failed: ${job.workflowId}`, {
        jobId,
        error: error.message,
      });
    }
  }

  /**
   * Stop a scheduled job
   */
  async stop(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.task.stop();
    job.isActive = false;

    await prisma.scheduleTrigger.update({
      where: { id: jobId },
      data: { isActive: false }
    });

    logger.info(`Stopped scheduled job in DB: ${jobId}`);
    return true;
  }

  /**
   * Resume a stopped job
   */
  async resume(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.task.start();
    job.isActive = true;
    job.nextRunAt = this.getNextRunTime(job.cronExpression);

    await prisma.scheduleTrigger.update({
      where: { id: jobId },
      data: {
        isActive: true,
        nextRunAt: job.nextRunAt
      }
    });

    logger.info(`Resumed scheduled job in DB: ${jobId}`);
    return true;
  }

  /**
   * Remove a scheduled job
   */
  async remove(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.task.stop();
    }
    
    this.jobs.delete(jobId);

    // Check if it exists in DB before deleting
    const exists = await prisma.scheduleTrigger.findUnique({ where: { id: jobId } });
    if (exists) {
      await prisma.scheduleTrigger.delete({ where: { id: jobId } });
    }

    logger.info(`Removed scheduled job from DB: ${jobId}`);
    return true;
  }

  /**
   * List all scheduled jobs from the database
   */
  async list(): Promise<Array<{
    id: string;
    workflowId: string;
    cronExpression: string;
    timezone: string;
    isActive: boolean;
    lastRunAt?: Date;
    nextRunAt?: Date;
  }>> {
    const triggers = await prisma.scheduleTrigger.findMany();
    return triggers.map(t => ({
      id: t.id,
      workflowId: t.workflowId,
      cronExpression: t.cronExpr,
      timezone: t.timezone,
      isActive: t.isActive,
      lastRunAt: t.lastRunAt || undefined,
      nextRunAt: t.nextRunAt || undefined,
    }));
  }

  /**
   * Get next run time (simplistic estimation)
   */
  private getNextRunTime(cronExpression: string): Date {
    const now = new Date();
    return new Date(now.getTime() + 60000); // 1 minute estimate
  }

  /**
   * Validate a cron expression
   */
  validateCron(expression: string): boolean {
    return cron.validate(expression);
  }

  /**
   * Parse cron to human-readable format
   */
  describeCron(expression: string): string {
    const parts = expression.split(' ');
    if (parts.length !== 5) return 'Invalid cron expression';

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (expression === '* * * * *') return 'Every minute';
    if (expression === '0 * * * *') return 'Every hour';
    if (expression === '0 0 * * *') return 'Every day at midnight';
    if (expression === '0 0 * * 0') return 'Every Sunday at midnight';
    if (expression === '0 9 * * 1-5') return 'Every weekday at 9:00 AM';
    
    return `At ${minute} ${hour} on day ${dayOfMonth} of ${month}, weekday ${dayOfWeek}`;
  }
}

export const schedulerService = new SchedulerService();
export default schedulerService;
