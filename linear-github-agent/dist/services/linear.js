"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinearService = void 0;
const sdk_1 = require("@linear/sdk");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
class LinearService {
    constructor() {
        this.client = new sdk_1.LinearClient({
            apiKey: config_1.config.linearApiKey,
        });
    }
    /**
     * Get issue by ID with team and state information
     */
    async getIssue(issueId) {
        try {
            logger_1.logger.linear(`Fetching issue: ${issueId}`);
            const issue = await this.client.issue(issueId);
            const team = await issue.team;
            const state = await issue.state;
            const assignee = await issue.assignee;
            const creator = await issue.creator;
            if (!team || !state || !creator) {
                throw new Error(`Issue ${issueId} is missing required data (team, state, or creator)`);
            }
            // Fetch organization data
            const organization = await team.organization;
            const result = {
                id: issue.id,
                identifier: issue.identifier,
                title: issue.title,
                description: issue.description || undefined,
                state: {
                    id: state.id,
                    name: state.name,
                    type: state.type,
                    color: state.color,
                    description: state.description || undefined,
                },
                team: {
                    id: team.id,
                    name: team.name,
                    key: team.key,
                    description: team.description || undefined,
                    organization: {
                        id: organization.id,
                        name: organization.name,
                        urlKey: organization.urlKey,
                    },
                    gitAutomationSettings: undefined, // We'll handle this differently
                },
                assignee: assignee ? {
                    id: assignee.id,
                    name: assignee.name,
                    email: assignee.email,
                    avatarUrl: assignee.avatarUrl || undefined,
                } : undefined,
                creator: {
                    id: creator.id,
                    name: creator.name,
                    email: creator.email,
                    avatarUrl: creator.avatarUrl || undefined,
                },
                createdAt: issue.createdAt.toISOString(),
                updatedAt: issue.updatedAt.toISOString(),
                url: issue.url,
            };
            logger_1.logger.linear(`Successfully fetched issue: ${issue.identifier}`);
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Failed to fetch issue ${issueId}:`, error);
            throw new Error(`Failed to fetch issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Update issue with new state or other properties
     */
    async updateIssue(request) {
        try {
            logger_1.logger.linear(`Updating issue: ${request.id}`, { request });
            const updateData = {};
            if (request.stateId) {
                updateData.stateId = request.stateId;
            }
            if (request.assigneeId) {
                updateData.assigneeId = request.assigneeId;
            }
            if (request.description !== undefined) {
                updateData.description = request.description;
            }
            if (request.title) {
                updateData.title = request.title;
            }
            const result = await this.client.updateIssue(request.id, updateData);
            if (!result.success) {
                throw new Error('Failed to update issue');
            }
            logger_1.logger.linear(`Successfully updated issue: ${request.id}`);
            // Return the updated issue
            return await this.getIssue(request.id);
        }
        catch (error) {
            logger_1.logger.error(`Failed to update issue ${request.id}:`, error);
            throw new Error(`Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create a comment on an issue
     */
    async createComment(request) {
        try {
            logger_1.logger.linear(`Creating comment on issue: ${request.issueId}`, { body: request.body });
            const result = await this.client.createComment({
                issueId: request.issueId,
                body: request.body,
                createAsUser: request.createAsUser,
            });
            if (!result.success) {
                throw new Error('Failed to create comment');
            }
            // Note: In a real implementation, you might want to fetch the created comment
            // For now, we'll return a simplified version
            const comment = {
                id: (await result.comment).id,
                body: request.body,
                issue: await this.getIssue(request.issueId),
                user: {
                    id: 'system', // This would be the actual user ID
                    name: 'Linear Agent',
                    email: 'agent@linear.app',
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            logger_1.logger.linear(`Successfully created comment on issue: ${request.issueId}`);
            return comment;
        }
        catch (error) {
            logger_1.logger.error(`Failed to create comment on issue ${request.issueId}:`, error);
            throw new Error(`Failed to create comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create an attachment on an issue
     */
    async createAttachment(request) {
        try {
            logger_1.logger.linear(`Creating attachment on issue: ${request.issueId}`, { title: request.title, url: request.url });
            const result = await this.client.createAttachment({
                issueId: request.issueId,
                title: request.title,
                url: request.url,
                subtitle: request.subtitle,
            });
            if (!result.success) {
                throw new Error('Failed to create attachment');
            }
            // Note: In a real implementation, you might want to fetch the created attachment
            const attachment = {
                id: (await result.attachment).id,
                title: request.title,
                url: request.url,
                subtitle: request.subtitle,
                issue: await this.getIssue(request.issueId),
                creator: {
                    id: 'system',
                    name: 'Linear Agent',
                    email: 'agent@linear.app',
                },
                createdAt: new Date().toISOString(),
            };
            logger_1.logger.linear(`Successfully created attachment on issue: ${request.issueId}`);
            return attachment;
        }
        catch (error) {
            logger_1.logger.error(`Failed to create attachment on issue ${request.issueId}:`, error);
            throw new Error(`Failed to create attachment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Find the "In Progress" state for a team
     */
    async findInProgressState(teamId) {
        try {
            logger_1.logger.linear(`Finding in-progress state for team: ${teamId}`);
            const team = await this.client.team(teamId);
            const states = await team.states();
            // Look for states that match our configured "in progress" names
            for (const stateName of config_1.config.defaultInProgressStateNames) {
                const state = states.nodes.find((s) => s.name.toLowerCase() === stateName.toLowerCase() ||
                    s.type === 'started');
                if (state) {
                    logger_1.logger.linear(`Found in-progress state: ${state.name} (${state.id})`);
                    return {
                        id: state.id,
                        name: state.name,
                        type: state.type,
                        color: state.color,
                        description: state.description || undefined,
                    };
                }
            }
            logger_1.logger.warn(`No in-progress state found for team ${teamId}`);
            return null;
        }
        catch (error) {
            logger_1.logger.error(`Failed to find in-progress state for team ${teamId}:`, error);
            return null;
        }
    }
    /**
     * Extract repository information from team settings
     */
    async getRepositoryInfoFromTeam(teamId) {
        try {
            logger_1.logger.linear(`Getting repository info for team: ${teamId}`);
            const team = await this.client.team(teamId);
            // Try to get integration settings
            const integrationsSettings = await team.integrationsSettings;
            if (!integrationsSettings) {
                logger_1.logger.warn(`No integrations settings configured for team ${teamId}`);
                return null;
            }
            // For now, we'll use a placeholder approach since the exact structure 
            // of integration settings for GitHub may vary
            // In a real implementation, you'd inspect the integrationsSettings object
            // to find GitHub repository configuration
            // As a fallback, try to derive from team name or use a default
            const repositoryInfo = {
                owner: 'your-github-org', // This should be configured or derived
                repo: team.name.toLowerCase().replace(/\s+/g, '-'), // Convert team name to repo name
                fullName: `your-github-org/${team.name.toLowerCase().replace(/\s+/g, '-')}`,
                defaultBranch: 'main',
            };
            logger_1.logger.linear(`Using derived repository info for team: ${repositoryInfo.fullName}`);
            return repositoryInfo;
        }
        catch (error) {
            logger_1.logger.error(`Failed to get repository info for team ${teamId}:`, error);
            return null;
        }
    }
    /**
     * Mark issue as in progress with a comment
     */
    async markIssueInProgress(issueId, message) {
        try {
            logger_1.logger.linear(`Marking issue as in progress: ${issueId}`);
            const issue = await this.getIssue(issueId);
            const inProgressState = await this.findInProgressState(issue.team.id);
            if (inProgressState) {
                await this.updateIssue({
                    id: issueId,
                    stateId: inProgressState.id,
                });
            }
            await this.createComment({
                issueId,
                body: message,
            });
            logger_1.logger.linear(`Successfully marked issue as in progress: ${issueId}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to mark issue as in progress ${issueId}:`, error);
            throw error;
        }
    }
}
exports.LinearService = LinearService;
