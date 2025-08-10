// Linear API Types for Agent Integration

export interface LinearWebhookEvent {
  action: string;
  type: string;
  data: LinearEventData;
  url: string;
  actor?: LinearUser;
  organizationId: string;
  webhookTimestamp: string;
  webhookId: string;
}

export interface LinearEventData {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface LinearAgentRequestEvent extends LinearWebhookEvent {
  action: 'agent_request';
  data: LinearAgentRequest;
}

export interface LinearAgentRequest extends LinearEventData {
  issueId: string;
  teamId: string;
  prompt: string;
  context: string;
  requestedAt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: LinearWorkflowState;
  team: LinearTeam;
  assignee?: LinearUser;
  creator: LinearUser;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface LinearWorkflowState {
  id: string;
  name: string;
  type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color: string;
  description?: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string | undefined;
  organization: LinearOrganization;
  gitAutomationSettings?: LinearGitAutomationSettings | undefined;
}

export interface LinearGitAutomationSettings {
  githubRepositoryPath?: string | undefined;
  githubOrg?: string | undefined;
  githubRepo?: string | undefined;
}

export interface LinearOrganization {
  id: string;
  name: string;
  urlKey: string;
}

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface LinearComment {
  id: string;
  body: string;
  issue: LinearIssue;
  user: LinearUser;
  createdAt: string;
  updatedAt: string;
}

export interface LinearAttachment {
  id: string;
  title: string;
  url: string;
  subtitle?: string | undefined;
  issue: LinearIssue;
  creator: LinearUser;
  createdAt: string;
}

// Request/Response types for Linear API operations
export interface CreateCommentRequest {
  issueId: string;
  body: string;
  createAsUser?: string;
}

export interface UpdateIssueRequest {
  id: string;
  stateId?: string;
  assigneeId?: string;
  description?: string;
  title?: string;
}

export interface CreateAttachmentRequest {
  issueId: string;
  title: string;
  url: string;
  subtitle?: string;
}

export interface LinearApiError {
  message: string;
  extensions?: {
    code: string;
    userPresentableMessage?: string;
  };
}

export interface LinearResponse<T> {
  data?: T;
  errors?: LinearApiError[];
}

// Repository information extracted from Linear team settings
export interface RepositoryInfo {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
}

// Agent response types
export interface AgentProgress {
  issueId: string;
  status: 'starting' | 'creating_codespace' | 'codespace_ready' | 'setup_complete' | 'error';
  message: string;
  codespaceUrl?: string;
  timestamp: string;
  error?: string;
}