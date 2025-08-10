import { LinearService } from '../services/linear';
import { GitHubService } from '../services/github';
import { logger } from '../utils/logger';
import type {
  LinearAgentRequestEvent,
  LinearAgentRequest,
  AgentProgress,
  RepositoryInfo
} from '../types/linear';
import type { GitHubCodespace } from '../types/github';

export class AgentRequestHandler {
  private linearService: LinearService;
  private githubService: GitHubService;

  constructor() {
    this.linearService = new LinearService();
    this.githubService = new GitHubService();
  }

  /**
   * Handle an agent request from Linear
   */
  async handleAgentRequest(event: LinearAgentRequestEvent): Promise<void> {
    const { data } = event;
    const { issueId, teamId, prompt, context } = data;

    logger.info(`Processing agent request for issue: ${issueId}`, {
      issueId,
      teamId,
      promptLength: prompt.length,
      contextLength: context.length,
    });

    try {
      // Step 1: Immediate response - mark as starting and in progress
      await this.respondImmediately(issueId);

      // Step 2: Get repository information from Linear team
      const repositoryInfo = await this.getRepositoryInfo(teamId);
      if (!repositoryInfo) {
        throw new Error(`No GitHub repository configured for team ${teamId}`);
      }

      // Step 3: Create and configure GitHub Codespace
      const codespace = await this.createAndSetupCodespace(
        repositoryInfo,
        prompt,
        context,
        issueId
      );

      // Step 4: Wait for Codespace to be ready
      const readyCodespace = await this.waitForCodespaceReady(codespace.name);

      // Step 5: Final response - attach codespace link
      await this.attachCodespaceToIssue(issueId, readyCodespace);

      logger.info(`Successfully completed agent request for issue: ${issueId}`, {
        codespaceUrl: readyCodespace.web_url,
      });

    } catch (error) {
      logger.error(`Failed to process agent request for issue ${issueId}:`, error);
      await this.handleError(issueId, error);
    }
  }

  /**
   * Step 1: Respond immediately to Linear
   */
  private async respondImmediately(issueId: string): Promise<void> {
    try {
      logger.info(`Sending immediate response for issue: ${issueId}`);

      const message = `🚀 **Linear Agent Started**\n\nI've received your request and am starting work:\n\n` +
        `1. ✅ Acknowledged request\n` +
        `2. 🔄 Marking issue as in progress\n` +
        `3. ⏳ Creating GitHub Codespace\n` +
        `4. ⏳ Setting up development environment\n` +
        `5. ⏳ Configuring Claude integration\n\n` +
        `I'll update you once the Codespace is ready!`;

      await this.linearService.markIssueInProgress(issueId, message);

      logger.info(`Successfully sent immediate response for issue: ${issueId}`);
    } catch (error) {
      logger.error(`Failed to send immediate response for issue ${issueId}:`, error);
      throw new Error(`Failed to send immediate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 2: Get repository information from Linear team
   */
  private async getRepositoryInfo(teamId: string): Promise<RepositoryInfo | null> {
    try {
      logger.info(`Getting repository info for team: ${teamId}`);

      const repositoryInfo = await this.linearService.getRepositoryInfoFromTeam(teamId);

      if (!repositoryInfo) {
        logger.warn(`No repository configured for team: ${teamId}`);
        return null;
      }

      logger.info(`Found repository: ${repositoryInfo.fullName}`, repositoryInfo);
      return repositoryInfo;
    } catch (error) {
      logger.error(`Failed to get repository info for team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Step 3: Create and setup GitHub Codespace
   */
  private async createAndSetupCodespace(
    repositoryInfo: RepositoryInfo,
    prompt: string,
    context: string,
    issueId: string
  ): Promise<GitHubCodespace> {
    try {
      logger.codespace(`Creating codespace for issue: ${issueId}`);

      // Update Linear with progress
      await this.linearService.createComment({
        issueId,
        body: `🔧 **Creating GitHub Codespace**\n\n` +
          `Repository: **${repositoryInfo.fullName}**\n` +
          `Branch: **${repositoryInfo.defaultBranch}**\n\n` +
          `Setting up development environment with Claude integration...`,
      });

      const codespace = await this.githubService.createCodespace(
        repositoryInfo,
        prompt,
        context,
        issueId
      );

      logger.codespace(`Successfully created codespace: ${codespace.name}`, {
        codespaceId: codespace.id,
        state: codespace.state,
        url: codespace.web_url,
      });

      return codespace;
    } catch (error) {
      logger.error(`Failed to create codespace for issue ${issueId}:`, error);
      throw new Error(`Failed to create codespace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 4: Wait for Codespace to be ready
   */
  private async waitForCodespaceReady(codespaceName: string): Promise<GitHubCodespace> {
    try {
      logger.codespace(`Waiting for codespace to be ready: ${codespaceName}`);

      const readyCodespace = await this.githubService.waitForCodespaceReady(codespaceName);

      logger.codespace(`Codespace is ready: ${codespaceName}`, {
        state: readyCodespace.state,
        url: readyCodespace.web_url,
      });

      return readyCodespace;
    } catch (error) {
      logger.error(`Failed waiting for codespace ${codespaceName}:`, error);
      throw new Error(`Codespace failed to be ready: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 5: Attach Codespace link to Linear issue
   */
  private async attachCodespaceToIssue(issueId: string, codespace: GitHubCodespace): Promise<void> {
    try {
      logger.info(`Attaching codespace to issue: ${issueId}`);

      // Create success comment
      const successMessage = `✅ **GitHub Codespace Ready!**\n\n` +
        `Your development environment is now ready and configured with:\n\n` +
        `🖥️ **Codespace:** ${codespace.display_name || codespace.name}\n` +
        `🔗 **Web URL:** [Open Codespace](${codespace.web_url})\n` +
        `📁 **Repository:** ${codespace.repository.full_name}\n` +
        `⚙️ **Machine:** ${codespace.machine.display_name}\n\n` +
        `**Environment Setup:**\n` +
        `- ✅ Development container configured\n` +
        `- ✅ Claude integration prepared\n` +
        `- ✅ Task context loaded\n` +
        `- ✅ Ready for development\n\n` +
        `Click the link above to open your Codespace and start working!`;

      await this.linearService.createComment({
        issueId,
        body: successMessage,
      });

      // Attach the codespace link
      await this.linearService.createAttachment({
        issueId,
        title: `GitHub Codespace - ${codespace.display_name || codespace.name}`,
        url: codespace.web_url,
        subtitle: `${codespace.repository.full_name} • ${codespace.machine.display_name}`,
      });

      logger.info(`Successfully attached codespace to issue: ${issueId}`);
    } catch (error) {
      logger.error(`Failed to attach codespace to issue ${issueId}:`, error);
      throw error;
    }
  }

  /**
   * Handle errors and notify Linear
   */
  private async handleError(issueId: string, error: unknown): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      logger.error(`Handling error for issue ${issueId}:`, { error: errorMessage });

      const errorComment = `❌ **Error Processing Request**\n\n` +
        `I encountered an error while setting up your development environment:\n\n` +
        `**Error:** ${errorMessage}\n\n` +
        `**Next Steps:**\n` +
        `1. Check that the GitHub repository is accessible\n` +
        `2. Verify that GitHub Codespaces are enabled for the repository\n` +
        `3. Ensure the Linear team has the correct GitHub repository configured\n` +
        `4. Try the request again\n\n` +
        `If the problem persists, please check the server logs or contact support.`;

      await this.linearService.createComment({
        issueId,
        body: errorComment,
      });

      logger.info(`Error notification sent to Linear for issue: ${issueId}`);
    } catch (notificationError) {
      logger.error(`Failed to send error notification for issue ${issueId}:`, notificationError);
      // Don't throw here as we're already handling an error
    }
  }

  /**
   * Get current progress for an issue (utility method)
   */
  async getAgentProgress(issueId: string): Promise<AgentProgress> {
    try {
      // This is a utility method that could be used by a status endpoint
      // For now, we'll return a basic status
      return {
        issueId,
        status: 'starting',
        message: 'Agent request received and processing started',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        issueId,
        status: 'error',
        message: `Failed to get progress: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<{ status: string; services: Record<string, boolean> }> {
    const services = {
      linear: false,
      github: false,
    };

    try {
      // Test Linear connection (this would need to be implemented in LinearService)
      // For now, we'll assume it's healthy if the service can be instantiated
      services.linear = true;
    } catch (error) {
      logger.error('Linear service health check failed:', error);
    }

    try {
      // Test GitHub connection
      await this.githubService.listCodespaces();
      services.github = true;
    } catch (error) {
      logger.error('GitHub service health check failed:', error);
    }

    const allHealthy = Object.values(services).every(Boolean);

    return {
      status: allHealthy ? 'healthy' : 'partial',
      services,
    };
  }
}