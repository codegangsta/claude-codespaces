// GitHub API Types for Codespace Management

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  type: 'User' | 'Organization';
}

export interface GitHubCodespace {
  id: number;
  name: string;
  display_name?: string;
  environment_id: string;
  owner: GitHubUser;
  billable_owner: GitHubUser;
  repository: GitHubRepository;
  machine: GitHubCodespaceMachine;
  devcontainer_path?: string;
  prebuild: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string;
  state: CodespaceState;
  url: string;
  git_status: GitHubGitStatus;
  location: CodespaceLocation;
  idle_timeout_minutes?: number;
  web_url: string;
  machines_url: string;
  start_url: string;
  stop_url: string;
  recent_folders: string[];
}

export type CodespaceState = 
  | 'Unknown'
  | 'Created' 
  | 'Queued'
  | 'Provisioning'
  | 'Available'
  | 'Awaiting'
  | 'Unavailable'
  | 'Deleted'
  | 'Moved'
  | 'Shutdown'
  | 'Archived'
  | 'Starting'
  | 'ShuttingDown'
  | 'Failed'
  | 'Exporting'
  | 'Updating'
  | 'Rebuilding';

export type CodespaceLocation = 'EastUs' | 'SouthEastAsia' | 'WestEurope' | 'WestUs2';

export interface GitHubCodespaceMachine {
  name: string;
  display_name: string;
  operating_system: string;
  storage_in_bytes: number;
  memory_in_bytes: number;
  cpus: number;
}

export interface GitHubGitStatus {
  ahead?: number;
  behind?: number;
  has_unpushed_changes?: boolean;
  has_uncommitted_changes?: boolean;
  ref?: string;
}

// Request types for GitHub API operations
export interface CreateCodespaceRequest {
  owner: string;
  repo: string;
  ref?: string;
  location?: CodespaceLocation;
  machine?: string;
  devcontainer_path?: string;
  multi_repo_permissions_opt_out?: boolean;
  working_directory?: string;
  idle_timeout_minutes?: number;
  display_name?: string;
  retention_period_minutes?: number;
}

export interface UpdateCodespaceRequest {
  codespace_name: string;
  machine?: string;
  display_name?: string;
  recent_folders?: string[];
}

export interface DevcontainerConfiguration {
  name?: string;
  image?: string;
  dockerFile?: string;
  context?: string;
  build?: DevcontainerBuild;
  features?: Record<string, unknown>;
  overrideFeatureInstallOrder?: string[];
  mounts?: DevcontainerMount[];
  containerEnv?: Record<string, string>;
  containerUser?: string;
  updateContentCommand?: string | string[];
  postCreateCommand?: string | string[];
  postStartCommand?: string | string[];
  postAttachCommand?: string | string[];
  workspaceFolder?: string;
  workspaceMount?: string;
  shutdownAction?: 'none' | 'stopContainer';
  userEnvProbe?: 'none' | 'loginInteractiveShell' | 'loginShell' | 'interactiveShell';
  hostRequirements?: DevcontainerHostRequirements;
  secrets?: Record<string, DevcontainerSecret>;
  customizations?: DevcontainerCustomizations;
}

export interface DevcontainerBuild {
  dockerfile?: string;
  context?: string;
  args?: Record<string, string>;
  target?: string;
  cacheFrom?: string | string[];
}

export interface DevcontainerMount {
  source: string;
  target: string;
  type: 'bind' | 'volume' | 'tmpfs';
  consistency?: 'consistent' | 'cached' | 'delegated';
}

export interface DevcontainerHostRequirements {
  cpus?: number;
  memory?: string;
  storage?: string;
}

export interface DevcontainerSecret {
  description?: string;
  documentationUrl?: string;
}

export interface DevcontainerCustomizations {
  vscode?: {
    extensions?: string[];
    settings?: Record<string, unknown>;
  };
  codespaces?: {
    openFiles?: string[];
  };
}

export interface GitHubApiError {
  message: string;
  documentation_url?: string;
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
  }>;
}

// Repository information extracted from Linear team settings
export interface RepositoryInfo {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
}