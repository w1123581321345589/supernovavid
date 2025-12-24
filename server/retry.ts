// Retry utility with exponential backoff

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'NETWORK_ERROR',
    'RATE_LIMIT',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
};

export class RetryableError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === opts.maxRetries) {
        break;
      }

      // Check if error is retryable
      const isRetryable = isRetryableError(lastError, opts.retryableErrors);
      
      if (!isRetryable) {
        throw lastError;
      }

      console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms: ${lastError.message}`);
      
      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError;
}

function isRetryableError(error: Error, retryableErrors: string[]): boolean {
  // Check error code
  const errorCode = (error as any).code;
  if (errorCode && retryableErrors.includes(errorCode)) {
    return true;
  }

  // Check error message for status codes
  const errorMessage = error.message.toLowerCase();
  for (const pattern of retryableErrors) {
    if (errorMessage.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Check if it's a RetryableError
  if (error instanceof RetryableError) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Rate limiter for API calls
export class RateLimiter {
  private queue: Array<{
    operation: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  private processing = false;
  private lastRequestTime = 0;

  constructor(
    private readonly minInterval: number = 100,
    private readonly maxConcurrent: number = 1
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const elapsed = Date.now() - this.lastRequestTime;
      const waitTime = Math.max(0, this.minInterval - elapsed);

      if (waitTime > 0) {
        await sleep(waitTime);
      }

      const item = this.queue.shift();
      if (!item) continue;

      this.lastRequestTime = Date.now();

      try {
        const result = await item.operation();
        item.resolve(result);
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.processing = false;
  }
}

// Circuit breaker for external services
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  getState(): string {
    return this.state;
  }
}

export const youtubeRateLimiter = new RateLimiter(200, 1);
export const geminiRateLimiter = new RateLimiter(100, 1);
export const youtubeCircuitBreaker = new CircuitBreaker(5, 60000);
export const geminiCircuitBreaker = new CircuitBreaker(3, 30000);
