// Optional Bull import - will fall back to synchronous processing if not available
let Bull: any = null;
let Queue: any = null;
let Job: any = null;
try {
  Bull = require('bull');
  Queue = Bull.Queue;
  Job = Bull.Job;
} catch (error) {
  console.warn('⚠️ Bull not installed, GL posting will be synchronous');
}

import GLPostingService from '../services/accounting/GLPostingService.optimized';
import { GLPostingRequest } from '../services/accounting/GLPostingService.optimized';

/**
 * Background Job for GL Posting
 * 
 * This moves GL posting outside the main transaction to improve response time.
 * GL posting is processed asynchronously after the purchase is created.
 */

interface GLJobData {
  entryDate: Date;
  sourceModule: string;
  sourceTransactionId: number;
  sourceTransactionNumber: string;
  entries: Array<{
    accountCode: string;
    entryType: string;
    amount: number;
    description: string;
  }>;
  createdBy?: number;
}

class GLPostingJob {
  private queue: any = null;

  constructor() {
    this.initializeQueue();
  }

  private initializeQueue(): void {
    if (!Bull) {
      console.warn('⚠️ Bull not available, GL posting will be synchronous');
      return;
    }

    try {
      // Initialize Bull queue (requires Redis)
      // If Redis is not available, fall back to in-memory processing
      const Redis = require('redis');
      
      this.queue = new Queue('gl-posting', {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      });

      this.queue.process('post-gl-entries', this.processGLPosting.bind(this));

      console.log('✅ GL Posting Queue initialized with Redis');
    } catch (error) {
      console.warn('⚠️ Redis not available, GL posting will be synchronous');
      this.queue = null;
    }
  }

  /**
   * Add GL posting job to queue
   */
  async addGLPostingJob(data: GLJobData): Promise<void> {
    if (!this.queue) {
      // Fallback: Process synchronously
      console.log('⚠️ Processing GL posting synchronously (no queue)');
      await this.processGLPosting({ data } as any);
      return;
    }

    await this.queue.add('post-gl-entries', data, {
      priority: 1, // High priority for financial transactions
      delay: 100, // Small delay to ensure main transaction is committed
    });

    console.log(`✅ GL posting job added for transaction ${data.sourceTransactionNumber}`);
  }

  /**
   * Process GL posting job
   */
  private async processGLPosting(job: any): Promise<void> {
    const data = job.data as GLJobData;
    
    console.log(`📊 Processing GL posting for transaction ${data.sourceTransactionNumber}`);
    
    try {
      await GLPostingService.postGLEntries({
        entryDate: new Date(data.entryDate),
        sourceModule: data.sourceModule as any,
        sourceTransactionId: data.sourceTransactionId,
        sourceTransactionNumber: data.sourceTransactionNumber,
        entries: data.entries as any,
        createdBy: data.createdBy,
      });

      console.log(`✅ GL posting completed for transaction ${data.sourceTransactionNumber}`);
    } catch (error) {
      console.error(`❌ GL posting failed for transaction ${data.sourceTransactionNumber}:`, error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    if (!this.queue) {
      return { status: 'disabled', reason: 'Bull/Redis not available' };
    }

    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
    ]);

    return {
      status: 'enabled',
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
}

export default new GLPostingJob();
