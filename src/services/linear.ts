import { LinearClient } from '@linear/sdk';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import type {
  LinearIssue,
  LinearTeam,
  LinearWorkflowState,
  LinearComment,
  LinearAttachment,
  CreateCommentRequest,
  UpdateIssueRequest,
  CreateAttachmentRequest,
  LinearApiError,
  RepositoryInfo
} from '../types/linear';

export class LinearService {
  private client: LinearClient;

  constructor() {
    this.client = new LinearClient({
      apiKey: config.linearApiKey,
    });
  }

  /**
   * Get issue by ID with team and state information
   */
  async getIssue(issueId: string): Promise<LinearIssue> {
    try {
      logger.linear(`Fetching issue: ${issueId}`);
      
      const issue = await this.client.issue(issueId);
      const team = await issue.team;
      const state = await issue.state;
      const assignee = await issue.assignee;
      const creator = await issue.creator;

      if (!team || !state || !creator) {
        throw new Error(`Issue ${issueId} is missing required data (team, state, or creator)`);
      }

      const result: LinearIssue = {
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
            id: team.organization.id,
            name: team.organization.name,
            urlKey: team.organization.urlKey,
          },
          gitAutomationSettings: team.gitAutomationSettings ? {
            githubRepositoryPath: team.gitAutomationSettings.githubRepositoryPath,
            githubOrg: team.gitAutomationSettings.githubOrg,
            githubRepo: team.gitAutomationSettings.githubRepo,
          } : undefined,
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

      logger.linear(`Successfully fetched issue: ${issue.identifier}`);
      return result;
    } catch (error) {
      logger.error(`Failed to fetch issue ${issueId}:`, error);
      throw new Error(`Failed to fetch issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update issue with new state or other properties
   */
  async updateIssue(request: UpdateIssueRequest): Promise<LinearIssue> {
    try {
      logger.linear(`Updating issue: ${request.id}`, { request });

      const updateData: any = {};
      
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

      logger.linear(`Successfully updated issue: ${request.id}`);
      
      // Return the updated issue
      return await this.getIssue(request.id);
    } catch (error) {
      logger.error(`Failed to update issue ${request.id}:`, error);
      throw new Error(`Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a comment on an issue
   */
  async createComment(request: CreateCommentRequest): Promise<LinearComment> {
    try {
      logger.linear(`Creating comment on issue: ${request.issueId}`, { body: request.body });

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
      const comment: LinearComment = {
        id: result.comment.id,
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

      logger.linear(`Successfully created comment on issue: ${request.issueId}`);
      return comment;
    } catch (error) {
      logger.error(`Failed to create comment on issue ${request.issueId}:`, error);
      throw new Error(`Failed to create comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create an attachment on an issue
   */
  async createAttachment(request: CreateAttachmentRequest): Promise<LinearAttachment> {
    try {
      logger.linear(`Creating attachment on issue: ${request.issueId}`, { title: request.title, url: request.url });

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
      const attachment: LinearAttachment = {
        id: result.attachment.id,
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

      logger.linear(`Successfully created attachment on issue: ${request.issueId}`);
      return attachment;
    } catch (error) {
      logger.error(`Failed to create attachment on issue ${request.issueId}:`, error);
      throw new Error(`Failed to create attachment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find the "In Progress" state for a team
   */
  async findInProgressState(teamId: string): Promise<LinearWorkflowState | null> {
    try {
      logger.linear(`Finding in-progress state for team: ${teamId}`);

      const team = await this.client.team(teamId);
      const states = await team.states();

             // Look for states that match our configured "in progress" names
       for (const stateName of config.defaultInProgressStateNames) {
         const state = states.nodes.find((s: any) => 
           s.name.toLowerCase() === stateName.toLowerCase() ||
           s.type === 'started'
         );

        if (state) {
          logger.linear(`Found in-progress state: ${state.name} (${state.id})`);
          return {
            id: state.id,
            name: state.name,
            type: state.type,
            color: state.color,
            description: state.description || undefined,
          };
        }
      }

      logger.warn(`No in-progress state found for team ${teamId}`);
      return null;
    } catch (error) {
      logger.error(`Failed to find in-progress state for team ${teamId}:`, error);
      return null;
    }
  }

  /**
   * Extract repository information from team settings
   */
  async getRepositoryInfoFromTeam(teamId: string): Promise<RepositoryInfo | null> {
    try {
      logger.linear(`Getting repository info for team: ${teamId}`);

      const team = await this.client.team(teamId);
      
      if (!team.gitAutomationSettings?.githubRepositoryPath) {
        logger.warn(`No GitHub repository configured for team ${teamId}`);
        return null;
      }

      const repoPath = team.gitAutomationSettings.githubRepositoryPath;
      const [owner, repo] = repoPath.split('/');

      if (!owner || !repo) {
        logger.warn(`Invalid repository path format: ${repoPath}`);
        return null;
      }

      const repositoryInfo: RepositoryInfo = {
        owner,
        repo,
        fullName: repoPath,
        defaultBranch: 'main', // Default, could be fetched from GitHub API
      };

      logger.linear(`Found repository info for team: ${repoPath}`);
      return repositoryInfo;
    } catch (error) {
      logger.error(`Failed to get repository info for team ${teamId}:`, error);
      return null;
    }
  }

  /**
   * Mark issue as in progress with a comment
   */
  async markIssueInProgress(issueId: string, message: string): Promise<void> {
    try {
      logger.linear(`Marking issue as in progress: ${issueId}`);

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

      logger.linear(`Successfully marked issue as in progress: ${issueId}`);
    } catch (error) {
      logger.error(`Failed to mark issue as in progress ${issueId}:`, error);
      throw error;
    }
  }
}