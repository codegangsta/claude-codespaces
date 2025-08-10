"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubService = void 0;
const rest_1 = require("@octokit/rest");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
class GitHubService {
    constructor() {
        this.octokit = new rest_1.Octokit({
            auth: config_1.config.githubToken,
        });
    }
    /**
     * Get repository information
     */
    async getRepository(owner, repo) {
        try {
            logger_1.logger.github(`Fetching repository: ${owner}/${repo}`);
            const { data } = await this.octokit.rest.repos.get({
                owner,
                repo,
            });
            logger_1.logger.github(`Successfully fetched repository: ${data.full_name}`);
            // Type assertion to handle the owner.type field
            const repository = {
                ...data,
                owner: {
                    ...data.owner,
                    type: data.owner.type
                }
            };
            return repository;
        }
        catch (error) {
            logger_1.logger.error(`Failed to fetch repository ${owner}/${repo}:`, error);
            throw new Error(`Failed to fetch repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create a new Codespace for a repository
     */
    async createCodespace(repositoryInfo, prompt, context, issueId) {
        try {
            logger_1.logger.codespace(`Creating codespace for repository: ${repositoryInfo.fullName}`);
            // First, set up the devcontainer configuration
            await this.setupDevcontainer(repositoryInfo, prompt, context, issueId);
            const request = {
                owner: repositoryInfo.owner,
                repo: repositoryInfo.repo,
                ref: repositoryInfo.defaultBranch,
                machine: config_1.config.defaultCodespaceMachine,
                devcontainer_path: '.devcontainer/devcontainer.json',
                idle_timeout_minutes: config_1.config.codespaceIdleTimeoutMinutes,
                display_name: `Linear Agent - Issue ${issueId}`,
            };
            const { data } = await this.octokit.rest.codespaces.createWithRepoForAuthenticatedUser(request);
            logger_1.logger.codespace(`Successfully created codespace: ${data.name}`);
            // Type assertion to handle owner.type field
            const codespace = {
                ...data,
                owner: {
                    ...data.owner,
                    type: data.owner.type
                }
            };
            return codespace;
        }
        catch (error) {
            logger_1.logger.error(`Failed to create codespace for ${repositoryInfo.fullName}:`, error);
            throw new Error(`Failed to create codespace: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get Codespace by name
     */
    async getCodespace(codespaceName) {
        try {
            logger_1.logger.codespace(`Fetching codespace: ${codespaceName}`);
            const { data } = await this.octokit.rest.codespaces.getForAuthenticatedUser({
                codespace_name: codespaceName,
            });
            // Type assertion to handle owner.type field
            const codespace = {
                ...data,
                owner: {
                    ...data.owner,
                    type: data.owner.type
                }
            };
            return codespace;
        }
        catch (error) {
            logger_1.logger.error(`Failed to fetch codespace ${codespaceName}:`, error);
            throw new Error(`Failed to fetch codespace: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Wait for Codespace to be in 'Available' state
     */
    async waitForCodespaceReady(codespaceName, timeoutMs = 300000) {
        const startTime = Date.now();
        const pollInterval = 5000; // 5 seconds
        logger_1.logger.codespace(`Waiting for codespace to be ready: ${codespaceName}`);
        while (Date.now() - startTime < timeoutMs) {
            try {
                const codespace = await this.getCodespace(codespaceName);
                logger_1.logger.codespace(`Codespace ${codespaceName} state: ${codespace.state}`);
                if (codespace.state === 'Available') {
                    logger_1.logger.codespace(`Codespace is ready: ${codespaceName}`);
                    return codespace;
                }
                if (codespace.state === 'Failed' || codespace.state === 'Shutdown') {
                    throw new Error(`Codespace entered failed state: ${codespace.state}`);
                }
                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
            catch (error) {
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
    async setupDevcontainer(repositoryInfo, prompt, context, issueId) {
        try {
            logger_1.logger.github(`Setting up devcontainer for: ${repositoryInfo.fullName}`);
            const devcontainerConfig = {
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
            await this.createOrUpdateFile(repositoryInfo, '.devcontainer/devcontainer.json', JSON.stringify(devcontainerConfig, null, 2), `Configure Linear Agent workspace for issue ${issueId}`);
            // Also create a setup script for Claude
            const setupScript = this.generateClaudeSetupScript(prompt, context, issueId);
            await this.createOrUpdateFile(repositoryInfo, '.devcontainer/setup-claude.sh', setupScript, `Add Claude setup script for issue ${issueId}`);
            logger_1.logger.github(`Successfully set up devcontainer for: ${repositoryInfo.fullName}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to setup devcontainer for ${repositoryInfo.fullName}:`, error);
            throw error;
        }
    }
    /**
     * Create or update a file in the repository
     */
    async createOrUpdateFile(repositoryInfo, filePath, content, commitMessage) {
        try {
            logger_1.logger.github(`Creating/updating file: ${filePath} in ${repositoryInfo.fullName}`);
            // Check if file exists
            let sha;
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
            }
            catch (error) {
                // File doesn't exist, that's fine
                logger_1.logger.debug(`File ${filePath} doesn't exist, will create new file`);
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
            logger_1.logger.github(`Successfully created/updated file: ${filePath}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to create/update file ${filePath}:`, error);
            throw error;
        }
    }
    /**
     * Generate Claude setup script
     */
    generateClaudeSetupScript(prompt, context, issueId) {
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
    async deleteCodespace(codespaceName) {
        try {
            logger_1.logger.codespace(`Deleting codespace: ${codespaceName}`);
            await this.octokit.rest.codespaces.deleteForAuthenticatedUser({
                codespace_name: codespaceName,
            });
            logger_1.logger.codespace(`Successfully deleted codespace: ${codespaceName}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to delete codespace ${codespaceName}:`, error);
            throw new Error(`Failed to delete codespace: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * List user's Codespaces (for debugging/management)
     */
    async listCodespaces() {
        try {
            logger_1.logger.github('Listing user codespaces');
            const { data } = await this.octokit.rest.codespaces.listForAuthenticatedUser();
            logger_1.logger.github(`Found ${data.total_count} codespaces`);
            // Type assertion to handle owner.type fields
            const codespaces = data.codespaces.map(codespace => ({
                ...codespace,
                owner: {
                    ...codespace.owner,
                    type: codespace.owner.type
                }
            }));
            return codespaces;
        }
        catch (error) {
            logger_1.logger.error('Failed to list codespaces:', error);
            throw new Error(`Failed to list codespaces: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.GitHubService = GitHubService;
