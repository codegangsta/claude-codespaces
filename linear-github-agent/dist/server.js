"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinearAgentServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("./utils/config");
const logger_1 = require("./utils/logger");
const agent_request_1 = require("./handlers/agent-request");
class LinearAgentServer {
    constructor() {
        this.app = (0, express_1.default)();
        this.agentHandler = new agent_request_1.AgentRequestHandler();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Security middleware
        this.app.use((0, helmet_1.default)({
            contentSecurityPolicy: false, // Disable CSP for API server
        }));
        // CORS configuration
        this.app.use((0, cors_1.default)({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Linear-Signature'],
        }));
        // Logging middleware
        if (config_1.config.nodeEnv !== 'test') {
            this.app.use((0, morgan_1.default)('combined', {
                stream: {
                    write: (message) => logger_1.logger.info(message.trim()),
                },
            }));
        }
        // Raw body parser for webhook signature verification
        this.app.use('/webhook', express_1.default.raw({ type: 'application/json' }));
        // JSON body parser for other routes
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
    }
    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', this.handleHealthCheck.bind(this));
        // Status endpoint
        this.app.get('/status', this.handleStatus.bind(this));
        // Linear webhook endpoint
        this.app.post(config_1.config.webhookPath, this.handleLinearWebhook.bind(this));
        // Agent progress endpoint (for debugging/monitoring)
        this.app.get('/agent/progress/:issueId', this.handleAgentProgress.bind(this));
        // Codespace management endpoints (for debugging/management)
        this.app.get('/codespaces', this.handleListCodespaces.bind(this));
        this.app.delete('/codespaces/:name', this.handleDeleteCodespace.bind(this));
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Route ${req.method} ${req.originalUrl} not found`,
                timestamp: new Date().toISOString(),
            });
        });
    }
    /**
     * Setup error handling middleware
     */
    setupErrorHandling() {
        this.app.use((error, req, res, next) => {
            logger_1.logger.error('Express error handler:', {
                error: error.message,
                stack: error.stack,
                url: req.url,
                method: req.method,
            });
            const statusCode = 'statusCode' in error ? error.statusCode : 500;
            res.status(statusCode).json({
                error: 'Internal Server Error',
                message: config_1.config.nodeEnv === 'production' ? 'An error occurred' : error.message,
                timestamp: new Date().toISOString(),
            });
        });
    }
    /**
     * Health check endpoint
     */
    async handleHealthCheck(req, res) {
        try {
            const healthStatus = await this.agentHandler.healthCheck();
            res.status(healthStatus.status === 'healthy' ? 200 : 503).json({
                status: healthStatus.status,
                services: healthStatus.services,
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0',
            });
        }
        catch (error) {
            logger_1.logger.error('Health check failed:', error);
            res.status(503).json({
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            });
        }
    }
    /**
     * Status endpoint
     */
    handleStatus(req, res) {
        res.json({
            name: 'Linear GitHub Agent',
            version: process.env.npm_package_version || '1.0.0',
            environment: config_1.config.nodeEnv,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            config: {
                webhookPath: config_1.config.webhookPath,
                defaultCodespaceMachine: config_1.config.defaultCodespaceMachine,
                codespaceIdleTimeoutMinutes: config_1.config.codespaceIdleTimeoutMinutes,
            },
        });
    }
    /**
     * Linear webhook endpoint
     */
    async handleLinearWebhook(req, res) {
        try {
            // Verify webhook signature
            const signature = req.headers['x-linear-signature'];
            if (!this.verifyWebhookSignature(req.body, signature)) {
                logger_1.logger.warn('Invalid webhook signature received');
                res.status(401).json({ error: 'Invalid signature' });
                return;
            }
            // Parse webhook payload
            const payload = JSON.parse(req.body.toString());
            logger_1.logger.webhook('Received Linear webhook', {
                action: payload.action,
                type: payload.type,
                organizationId: payload.organizationId,
            });
            // Respond immediately to Linear
            res.status(200).json({
                received: true,
                timestamp: new Date().toISOString(),
            });
            // Process agent requests asynchronously
            if (payload.action === 'agent_request') {
                this.processAgentRequestAsync(payload);
            }
            else {
                logger_1.logger.debug(`Ignoring webhook action: ${payload.action}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error processing Linear webhook:', error);
            res.status(500).json({
                error: 'Webhook processing failed',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            });
        }
    }
    /**
     * Process agent request asynchronously
     */
    async processAgentRequestAsync(event) {
        try {
            await this.agentHandler.handleAgentRequest(event);
        }
        catch (error) {
            logger_1.logger.error('Error in async agent request processing:', error);
            // Error is already handled in the agent handler
        }
    }
    /**
     * Verify Linear webhook signature
     */
    verifyWebhookSignature(payload, signature) {
        if (!signature) {
            return false;
        }
        try {
            const expectedSignature = crypto_1.default
                .createHmac('sha256', config_1.config.webhookSecret)
                .update(payload)
                .digest('hex');
            const expectedSignatureWithPrefix = `sha256=${expectedSignature}`;
            return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignatureWithPrefix));
        }
        catch (error) {
            logger_1.logger.error('Error verifying webhook signature:', error);
            return false;
        }
    }
    /**
     * Get agent progress for an issue
     */
    async handleAgentProgress(req, res) {
        try {
            const { issueId } = req.params;
            if (!issueId) {
                res.status(400).json({ error: 'Issue ID is required' });
                return;
            }
            const progress = await this.agentHandler.getAgentProgress(issueId);
            res.json(progress);
        }
        catch (error) {
            logger_1.logger.error('Error getting agent progress:', error);
            res.status(500).json({
                error: 'Failed to get agent progress',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * List Codespaces (for debugging/management)
     */
    async handleListCodespaces(req, res) {
        try {
            // This would require adding a method to the GitHub service
            // For now, return a placeholder
            res.json({
                message: 'Codespace listing not implemented yet',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error listing codespaces:', error);
            res.status(500).json({
                error: 'Failed to list codespaces',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * Delete a Codespace (for debugging/management)
     */
    async handleDeleteCodespace(req, res) {
        try {
            const { name } = req.params;
            if (!name) {
                res.status(400).json({ error: 'Codespace name is required' });
                return;
            }
            // This would require adding a method to the GitHub service
            res.json({
                message: `Codespace deletion for ${name} not implemented yet`,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error deleting codespace:', error);
            res.status(500).json({
                error: 'Failed to delete codespace',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * Start the server
     */
    start() {
        this.app.listen(config_1.config.port, () => {
            logger_1.logger.info(`🚀 Linear GitHub Agent server started`, {
                port: config_1.config.port,
                environment: config_1.config.nodeEnv,
                webhookPath: config_1.config.webhookPath,
            });
        });
    }
    /**
     * Get Express app instance (for testing)
     */
    getApp() {
        return this.app;
    }
}
exports.LinearAgentServer = LinearAgentServer;
// Start server if this file is run directly
if (require.main === module) {
    const server = new LinearAgentServer();
    server.start();
}
