export interface CheckpointMetadata {
  id: string;
  timestamp: string;
  message?: string;
  commitHash: string;
  filesChanged: number;
  workspaceHash: string;
}

export interface CheckpointDiff {
  relativePath: string;
  absolutePath: string;
  before: string;
  after: string;
}

export interface CheckpointStatus {
  currentCheckpoint?: string;
  totalCheckpoints: number;
  workspaceHash: string;
  workspacePath: string;
  storagePath: string;
}

export interface CreateCheckpointResult {
  checkpointId: string;
  timestamp: string;
  filesChanged: number;
  commitHash: string;
}

export interface RollbackResult {
  success: boolean;
  filesRestored: number;
  message: string;
  checkpointId: string;
}

export interface CheckpointAddResult {
  success: boolean;
}