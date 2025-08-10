import { config } from './config';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

class Logger {
  private currentLevel: number;

  constructor(level: LogLevel = 'info') {
    this.currentLevel = LOG_LEVELS[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= this.currentLevel;
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
    }
    
    return `${prefix} ${message}`;
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  // Helper methods for specific contexts
  webhook(message: string, data?: unknown): void {
    this.info(`[WEBHOOK] ${message}`, data);
  }

  linear(message: string, data?: unknown): void {
    this.info(`[LINEAR] ${message}`, data);
  }

  github(message: string, data?: unknown): void {
    this.info(`[GITHUB] ${message}`, data);
  }

  codespace(message: string, data?: unknown): void {
    this.info(`[CODESPACE] ${message}`, data);
  }
}

// Export singleton instance
export const logger = new Logger(config.logLevel);