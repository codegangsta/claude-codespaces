import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file
dotenvConfig();

export interface AppConfig {
  // Server configuration
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  
  // API Keys
  linearApiKey: string;
  githubToken: string;
  
  // Webhook configuration
  webhookSecret: string;
  webhookPath: string;
  
  // GitHub configuration
  defaultCodespaceMachine: string;
  codespaceIdleTimeoutMinutes: number;
  
  // Linear configuration
  defaultInProgressStateNames: string[];
  
  // Logging
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  
  // Future Claude integration
  claudeApiKey?: string;
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(`Configuration Error: ${message}`);
    this.name = 'ConfigurationError';
  }
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    // In development/build mode, return placeholder values
    if (process.env.NODE_ENV !== 'production') {
      return `placeholder_${name.toLowerCase()}`;
    }
    throw new ConfigurationError(`Environment variable ${name} is required but not set`);
  }
  return value;
}

function getEnvVarAsNumber(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    throw new ConfigurationError(`Environment variable ${name} is required but not set`);
  }
  
  const numValue = value ? parseInt(value, 10) : defaultValue;
  if (numValue === undefined || isNaN(numValue)) {
    throw new ConfigurationError(`Environment variable ${name} must be a valid number`);
  }
  
  return numValue;
}

function getEnvVarAsArray(name: string, defaultValue: string[] = []): string[] {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function validateConfig(config: AppConfig): void {
  // Skip validation in non-production environments for build purposes
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  
  // Validate port range
  if (config.port < 1 || config.port > 65535) {
    throw new ConfigurationError('Port must be between 1 and 65535');
  }
  
  // Validate API keys format (basic validation)
  if (config.linearApiKey.length < 10) {
    throw new ConfigurationError('Linear API key appears to be invalid (too short)');
  }
  
  if (config.githubToken.length < 10) {
    throw new ConfigurationError('GitHub token appears to be invalid (too short)');
  }
  
  // Validate webhook secret
  if (config.webhookSecret.length < 8) {
    throw new ConfigurationError('Webhook secret should be at least 8 characters long');
  }
  
  // Validate timeout
  if (config.codespaceIdleTimeoutMinutes < 5 || config.codespaceIdleTimeoutMinutes > 10080) {
    throw new ConfigurationError('Codespace idle timeout must be between 5 minutes and 1 week (10080 minutes)');
  }
}

export function loadConfig(): AppConfig {
  try {
    const config: AppConfig = {
      // Server configuration
      port: getEnvVarAsNumber('PORT', 3000),
      nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development',
      
      // API Keys
      linearApiKey: getEnvVar('LINEAR_API_KEY'),
      githubToken: getEnvVar('GITHUB_TOKEN'),
      
      // Webhook configuration
      webhookSecret: getEnvVar('WEBHOOK_SECRET'),
      webhookPath: getEnvVar('WEBHOOK_PATH', '/webhook/linear'),
      
      // GitHub configuration
      defaultCodespaceMachine: getEnvVar('DEFAULT_CODESPACE_MACHINE', 'standardLinux32gb'),
      codespaceIdleTimeoutMinutes: getEnvVarAsNumber('CODESPACE_IDLE_TIMEOUT_MINUTES', 30),
      
      // Linear configuration
      defaultInProgressStateNames: getEnvVarAsArray('IN_PROGRESS_STATE_NAMES', ['In Progress', 'Started', 'Working']),
      
      // Logging
      logLevel: (process.env.LOG_LEVEL as AppConfig['logLevel']) || 'info',
      
      // Future Claude integration
      claudeApiKey: process.env.CLAUDE_API_KEY,
    };
    
    validateConfig(config);
    return config;
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(`❌ ${error.message}`);
      console.error('Please check your environment variables and try again.');
      process.exit(1);
    }
    throw error;
  }
}

// Export singleton instance
export const config = loadConfig();

// Helper function to check if we're in development mode
export const isDevelopment = () => config.nodeEnv === 'development';
export const isProduction = () => config.nodeEnv === 'production';
export const isTest = () => config.nodeEnv === 'test';