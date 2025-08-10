import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import crypto from 'crypto';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { AgentRequestHandler } from './handlers/agent-request';
import type { LinearWebhookEvent, LinearAgentRequestEvent } from './types/linear';

export class LinearAgentServer {
  private app: express.Application;
  private agentHandler: AgentRequestHandler;

  constructor() {
    this.app = express();
    this.agentHandler = new AgentRequestHandler();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable CSP for API server
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Linear-Signature'],
    }));

    // Logging middleware
    if (config.nodeEnv !== 'test') {
      this.app.use(morgan('combined', {
        stream: {
          write: (message: string) => logger.info(message.trim()),
        },
      }));
    }

    // Raw body parser for webhook signature verification
    this.app.use('/webhook', express.raw({ type: 'application/json' }));
    
    // JSON body parser for other routes
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', this.handleHealthCheck.bind(this));
    
    // Status endpoint
    this.app.get('/status', this.handleStatus.bind(this));

    // Linear webhook endpoint
    this.app.post(config.webhookPath, this.handleLinearWebhook.bind(this));

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
  private setupErrorHandling(): void {
    this.app.use((
      error: Error,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      logger.error('Express error handler:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
      });

      const statusCode = 'statusCode' in error ? (error as any).statusCode : 500;

      res.status(statusCode).json({
        error: 'Internal Server Error',
        message: config.nodeEnv === 'production' ? 'An error occurred' : error.message,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Health check endpoint
   */
  private async handleHealthCheck(req: express.Request, res: express.Response): Promise<void> {
    try {
      const healthStatus = await this.agentHandler.healthCheck();
      
      res.status(healthStatus.status === 'healthy' ? 200 : 503).json({
        status: healthStatus.status,
        services: healthStatus.services,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      });
    } catch (error) {
      logger.error('Health check failed:', error);
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
  private handleStatus(req: express.Request, res: express.Response): void {
    res.json({
      name: 'Linear GitHub Agent',
      version: process.env.npm_package_version || '1.0.0',
      environment: config.nodeEnv,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      config: {
        webhookPath: config.webhookPath,
        defaultCodespaceMachine: config.defaultCodespaceMachine,
        codespaceIdleTimeoutMinutes: config.codespaceIdleTimeoutMinutes,
      },
    });
  }

  /**
   * Linear webhook endpoint
   */
  private async handleLinearWebhook(req: express.Request, res: express.Response): Promise<void> {
    try {
      // Verify webhook signature
      const signature = req.headers['x-linear-signature'] as string;
      if (!this.verifyWebhookSignature(req.body, signature)) {
        logger.warn('Invalid webhook signature received');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Parse webhook payload
      const payload: LinearWebhookEvent = JSON.parse(req.body.toString());
      
      logger.webhook('Received Linear webhook', {
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
        this.processAgentRequestAsync(payload as LinearAgentRequestEvent);
      } else {
        logger.debug(`Ignoring webhook action: ${payload.action}`);
      }

    } catch (error) {
      logger.error('Error processing Linear webhook:', error);
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
  private async processAgentRequestAsync(event: LinearAgentRequestEvent): Promise<void> {
    try {
      await this.agentHandler.handleAgentRequest(event);
    } catch (error) {
      logger.error('Error in async agent request processing:', error);
      // Error is already handled in the agent handler
    }
  }

  /**
   * Verify Linear webhook signature
   */
  private verifyWebhookSignature(payload: Buffer, signature: string): boolean {
    if (!signature) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', config.webhookSecret)
        .update(payload)
        .digest('hex');

      const expectedSignatureWithPrefix = `sha256=${expectedSignature}`;
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignatureWithPrefix)
      );
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Get agent progress for an issue
   */
  private async handleAgentProgress(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { issueId } = req.params;
      
      if (!issueId) {
        res.status(400).json({ error: 'Issue ID is required' });
        return;
      }

      const progress = await this.agentHandler.getAgentProgress(issueId);
      res.json(progress);
    } catch (error) {
      logger.error('Error getting agent progress:', error);
      res.status(500).json({
        error: 'Failed to get agent progress',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * List Codespaces (for debugging/management)
   */
  private async handleListCodespaces(req: express.Request, res: express.Response): Promise<void> {
    try {
      // This would require adding a method to the GitHub service
      // For now, return a placeholder
      res.json({
        message: 'Codespace listing not implemented yet',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error listing codespaces:', error);
      res.status(500).json({
        error: 'Failed to list codespaces',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete a Codespace (for debugging/management)
   */
  private async handleDeleteCodespace(req: express.Request, res: express.Response): Promise<void> {
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
    } catch (error) {
      logger.error('Error deleting codespace:', error);
      res.status(500).json({
        error: 'Failed to delete codespace',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Start the server
   */
  public start(): void {
    this.app.listen(config.port, () => {
      logger.info(`🚀 Linear GitHub Agent server started`, {
        port: config.port,
        environment: config.nodeEnv,
        webhookPath: config.webhookPath,
      });
    });
  }

  /**
   * Get Express app instance (for testing)
   */
  public getApp(): express.Application {
    return this.app;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new LinearAgentServer();
  server.start();
}