"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const config_1 = require("./config");
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};
class Logger {
    constructor(level = 'info') {
        this.currentLevel = LOG_LEVELS[level];
    }
    shouldLog(level) {
        return LOG_LEVELS[level] <= this.currentLevel;
    }
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        if (data) {
            return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
        }
        return `${prefix} ${message}`;
    }
    error(message, data) {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, data));
        }
    }
    warn(message, data) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, data));
        }
    }
    info(message, data) {
        if (this.shouldLog('info')) {
            console.info(this.formatMessage('info', message, data));
        }
    }
    debug(message, data) {
        if (this.shouldLog('debug')) {
            console.debug(this.formatMessage('debug', message, data));
        }
    }
    // Helper methods for specific contexts
    webhook(message, data) {
        this.info(`[WEBHOOK] ${message}`, data);
    }
    linear(message, data) {
        this.info(`[LINEAR] ${message}`, data);
    }
    github(message, data) {
        this.info(`[GITHUB] ${message}`, data);
    }
    codespace(message, data) {
        this.info(`[CODESPACE] ${message}`, data);
    }
}
// Export singleton instance
exports.logger = new Logger(config_1.config.logLevel);
