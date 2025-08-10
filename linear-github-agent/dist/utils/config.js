"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTest = exports.isProduction = exports.isDevelopment = exports.config = void 0;
exports.loadConfig = loadConfig;
const dotenv_1 = require("dotenv");
// Load environment variables from .env file
(0, dotenv_1.config)();
class ConfigurationError extends Error {
    constructor(message) {
        super(`Configuration Error: ${message}`);
        this.name = 'ConfigurationError';
    }
}
function getEnvVar(name, defaultValue) {
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
function getEnvVarAsNumber(name, defaultValue) {
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
function getEnvVarAsArray(name, defaultValue = []) {
    const value = process.env[name];
    if (!value) {
        return defaultValue;
    }
    return value.split(',').map(item => item.trim()).filter(Boolean);
}
function validateConfig(config) {
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
function loadConfig() {
    try {
        const config = {
            // Server configuration
            port: getEnvVarAsNumber('PORT', 3000),
            nodeEnv: process.env.NODE_ENV || 'development',
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
            logLevel: process.env.LOG_LEVEL || 'info',
            // Future Claude integration
            claudeApiKey: process.env.CLAUDE_API_KEY,
        };
        validateConfig(config);
        return config;
    }
    catch (error) {
        if (error instanceof ConfigurationError) {
            console.error(`❌ ${error.message}`);
            console.error('Please check your environment variables and try again.');
            process.exit(1);
        }
        throw error;
    }
}
// Export singleton instance
exports.config = loadConfig();
// Helper function to check if we're in development mode
const isDevelopment = () => exports.config.nodeEnv === 'development';
exports.isDevelopment = isDevelopment;
const isProduction = () => exports.config.nodeEnv === 'production';
exports.isProduction = isProduction;
const isTest = () => exports.config.nodeEnv === 'test';
exports.isTest = isTest;
