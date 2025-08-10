import { Octokit } from '@octokit/rest';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import type {
  GitHubCodespace,
  GitHubRepository,
  CreateCodespaceRequest,
  DevcontainerConfiguration,
  CodespaceState,
  RepositoryInfo,
  GitHubApiError
} from '../types/github';

export class GitHubService {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: config.githubToken,
    });
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      logger.github(`Fetching repository: ${owner}/${repo}`);

      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      logger.github(`Successfully fetched repository: ${data.full_name}`);
      // Type assertion to handle the owner.type field
      const repository: GitHubRepository = {
        ...data,
        owner: {
          ...data.owner,
          type: (data.owner.type as "User" | "Organization")
        }
      } as GitHubRepository;
      
      return repository;
    } catch (error) {
      logger.error(`Failed to fetch repository ${owner}/${repo}:`, error);
      throw new Error(`Failed to fetch repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new Codespace for a repository
   */
  async createCodespace(
    repositoryInfo: RepositoryInfo,
    prompt: string,
    context: string,
    issueId: string
  ): Promise<GitHubCodespace> {
    try {
      logger.codespace(`Creating codespace for repository: ${repositoryInfo.fullName}`);

      // First, set up the devcontainer configuration
      await this.setupDevcontainer(repositoryInfo, prompt, context, issueId);

      const request = {
        owner: repositoryInfo.owner,
        repo: repositoryInfo.repo,
        ref: repositoryInfo.defaultBranch,
        machine: config.defaultCodespaceMachine,
        devcontainer_path: '.devcontainer/devcontainer.json',
        idle_timeout_minutes: config.codespaceIdleTimeoutMinutes,
        display_name: `Linear Agent - Issue ${issueId}`,
      };

      const { data } = await this.octokit.rest.codespaces.createWithRepoForAuthenticatedUser(request);

      logger.codespace(`Successfully created codespace: ${data.name}`);
      // Type assertion to handle owner.type field
      const codespace: GitHubCodespace = {
        ...data,
        owner: {
          ...data.owner,
          type: (data.owner.type as "User" | "Organization")
        }
      } as GitHubCodespace;

      return codespace;
    } catch (error) {
      logger.error(`Failed to create codespace for ${repositoryInfo.fullName}:`, error);
      throw new Error(`Failed to create codespace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get Codespace by name
   */
  async getCodespace(codespaceName: string): Promise<GitHubCodespace> {
    try {
      logger.codespace(`Fetching codespace: ${codespaceName}`);

      const { data } = await this.octokit.rest.codespaces.getForAuthenticatedUser({
        codespace_name: codespaceName,
      });

      // Type assertion to handle owner.type field
      const codespace: GitHubCodespace = {
        ...data,
        owner: {
          ...data.owner,
          type: (data.owner.type as "User" | "Organization")
        }
      } as GitHubCodespace;

      return codespace;
    } catch (error) {
      logger.error(`Failed to fetch codespace ${codespaceName}:`, error);
      throw new Error(`Failed to fetch codespace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for Codespace to be in 'Available' state
   */
  async waitForCodespaceReady(codespaceName: string, timeoutMs: number = 300000): Promise<GitHubCodespace> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    logger.codespace(`Waiting for codespace to be ready: ${codespaceName}`);

    while (Date.now() - startTime < timeoutMs) {
      try {
        const codespace = await this.getCodespace(codespaceName);
        
        logger.codespace(`Codespace ${codespaceName} state: ${codespace.state}`);

        if (codespace.state === 'Available') {
          logger.codespace(`Codespace is ready: ${codespaceName}`);
          return codespace;
        }

        if (codespace.state === 'Failed' || codespace.state === 'Shutdown') {
          throw new Error(`Codespace entered failed state: ${codespace.state}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        if (Date.now() - startTime >= timeoutMs) {
          throw new Error(`Timeout waiting for codespace to be ready: ${codespaceName}`);
        }
        // Continue polling on errors (might be temporary)
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`Timeout waiting for codespace to be ready: ${codespaceName}`);
  }

  /**
   * Set up devcontainer configuration for Claude integration
   */
  private async setupDevcontainer(
    repositoryInfo: RepositoryInfo,
    prompt: string,
    context: string,
    issueId: string
  ): Promise<void> {
    try {
      logger.github(`Setting up devcontainer for: ${repositoryInfo.fullName}`);

      const devcontainerConfig: DevcontainerConfiguration = {
        name: 'Linear Agent Workspace',
        image: 'mcr.microsoft.com/devcontainers/typescript-node:latest',
        features: {
          'ghcr.io/devcontainers/features/github-cli:1': {},
          'ghcr.io/devcontainers/features/node:1': {
            version: '18'
          }
        },
        customizations: {
          vscode: {
            extensions: [
              'ms-vscode.vscode-typescript-next',
              'esbenp.prettier-vscode',
              'ms-vscode.vscode-json'
            ],
            settings: {
              'terminal.integrated.defaultProfile.linux': 'bash'
            }
          },
          codespaces: {
            openFiles: ['README.md']
          }
        },
        containerEnv: {
          CLAUDE_PROMPT: prompt,
          CLAUDE_CONTEXT: context,
          LINEAR_ISSUE_ID: issueId,
          WORKSPACE_TYPE: 'linear-agent'
        },
        postCreateCommand: [
          'echo "Setting up Linear Agent workspace..."',
          'echo "Prompt: $CLAUDE_PROMPT"',
          'echo "Context: $CLAUDE_CONTEXT"',
          'echo "Issue ID: $LINEAR_ISSUE_ID"',
          'echo "TODO: Install and configure Claude Desktop"',
          'echo "Workspace setup complete!"'
        ],
        workspaceFolder: '/workspaces/' + repositoryInfo.repo,
        shutdownAction: 'stopContainer'
      };

      await this.createOrUpdateFile(
        repositoryInfo,
        '.devcontainer/devcontainer.json',
        JSON.stringify(devcontainerConfig, null, 2),
        `Configure Linear Agent workspace for issue ${issueId}`
      );

      // Also create a setup script for Claude
      const setupScript = this.generateClaudeSetupScript(prompt, context, issueId);
      await this.createOrUpdateFile(
        repositoryInfo,
        '.devcontainer/setup-claude.sh',
        setupScript,
        `Add Claude setup script for issue ${issueId}`
      );

      logger.github(`Successfully set up devcontainer for: ${repositoryInfo.fullName}`);
    } catch (error) {
      logger.error(`Failed to setup devcontainer for ${repositoryInfo.fullName}:`, error);
      throw error;
    }
  }

  /**
   * Create or update a file in the repository
   */
  private async createOrUpdateFile(
    repositoryInfo: RepositoryInfo,
    filePath: string,
    content: string,
    commitMessage: string
  ): Promise<void> {
    try {
      logger.github(`Creating/updating file: ${filePath} in ${repositoryInfo.fullName}`);

      // Check if file exists
      let sha: string | undefined;
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner: repositoryInfo.owner,
          repo: repositoryInfo.repo,
          path: filePath,
          ref: repositoryInfo.defaultBranch,
        });

        if ('sha' in data) {
          sha = data.sha;
        }
      } catch (error) {
        // File doesn't exist, that's fine
        logger.debug(`File ${filePath} doesn't exist, will create new file`);
      }

      // Create or update the file
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: repositoryInfo.owner,
        repo: repositoryInfo.repo,
        path: filePath,
        message: commitMessage,
        content: Buffer.from(content).toString('base64'),
        branch: repositoryInfo.defaultBranch,
        sha, // Include SHA if updating existing file
      });

      logger.github(`Successfully created/updated file: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to create/update file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Generate Claude setup script
   */
  private generateClaudeSetupScript(prompt: string, context: string, issueId: string): string {
    return `#!/bin/bash

# Linear Agent Claude Setup Script
# Generated for Issue ID: ${issueId}

echo "🚀 Setting up Claude Desktop for Linear Agent..."

# Environment variables
export CLAUDE_PROMPT="${prompt.replace(/"/g, '\\"')}"
export CLAUDE_CONTEXT="${context.replace(/"/g, '\\"')}"
export LINEAR_ISSUE_ID="${issueId}"

echo "Issue ID: $LINEAR_ISSUE_ID"
echo "Prompt: $CLAUDE_PROMPT"
echo "Context preview: \${CLAUDE_CONTEXT:0:100}..."

# TODO: Install Claude Desktop when available
# This is a placeholder for future Claude Desktop installation
echo "📋 TODO: Install Claude Desktop"
echo "📋 TODO: Configure Claude with provided prompt and context"
echo "📋 TODO: Set up bidirectional communication with Linear Agent server"

# Create a work directory
mkdir -p /workspaces/linear-agent-work
cd /workspaces/linear-agent-work

# Create a README with the task information
cat > README.md << EOF
# Linear Agent Task

**Issue ID:** ${issueId}

## Prompt
\${CLAUDE_PROMPT}

## Context
\${CLAUDE_CONTEXT}

## Next Steps
1. Install Claude Desktop when available
2. Configure Claude with the provided prompt and context
3. Begin working on the task
4. Report progress back to Linear

## Environment Variables
- CLAUDE_PROMPT: Contains the task prompt
- CLAUDE_CONTEXT: Contains additional context
- LINEAR_ISSUE_ID: The Linear issue this task is for
EOF

echo "✅ Claude setup script completed!"
echo "📁 Work directory created at /workspaces/linear-agent-work"
echo "📖 Task information saved to README.md"

# Make the script executable for future runs
chmod +x "$0"
`;
  }

  /**
   * Delete a Codespace (cleanup utility)
   */
  async deleteCodespace(codespaceName: string): Promise<void> {
    try {
      logger.codespace(`Deleting codespace: ${codespaceName}`);

      await this.octokit.rest.codespaces.deleteForAuthenticatedUser({
        codespace_name: codespaceName,
      });

      logger.codespace(`Successfully deleted codespace: ${codespaceName}`);
    } catch (error) {
      logger.error(`Failed to delete codespace ${codespaceName}:`, error);
      throw new Error(`Failed to delete codespace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List user's Codespaces (for debugging/management)
   */
  async listCodespaces(): Promise<GitHubCodespace[]> {
    try {
      logger.github('Listing user codespaces');

      const { data } = await this.octokit.rest.codespaces.listForAuthenticatedUser();

      logger.github(`Found ${data.total_count} codespaces`);
      // Type assertion to handle owner.type fields
      const codespaces: GitHubCodespace[] = data.codespaces.map(codespace => ({
        ...codespace,
        owner: {
          ...codespace.owner,
          type: (codespace.owner.type as "User" | "Organization")
        }
      })) as GitHubCodespace[];
      
      return codespaces;
    } catch (error) {
      logger.error('Failed to list codespaces:', error);
      throw new Error(`Failed to list codespaces: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}