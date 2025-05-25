import { access, constants } from "fs/promises";
import * as path from "path";
import os from "os";

/**
 * Environment configuration for the checkpoint server
 */
export class CheckpointConfig {
  public readonly workspacePath: string;
  public readonly storagePath: string;
  public readonly exclusionsFile?: string;

  constructor() {
    this.workspacePath = this.getWorkspacePath();
    this.storagePath = this.getStoragePath();
    this.exclusionsFile = process.env.CHECKPOINT_EXCLUSIONS_FILE;
  }

  private getWorkspacePath(): string {
    const workspacePath = process.env.CHECKPOINT_WORKSPACE_PATH || process.cwd();
    return path.resolve(workspacePath);
  }

  private getStoragePath(): string {
    const storagePath = process.env.CHECKPOINT_STORAGE_PATH || 
                       path.join(os.homedir(), '.mcp-checkpoint');
    return path.resolve(storagePath);
  }

  /**
   * Validates the workspace and storage paths
   */
  async validate(): Promise<void> {
    await this.validateWorkspacePath();
    await this.validateStoragePath();
  }

  private async validateWorkspacePath(): Promise<void> {
    try {
      await access(this.workspacePath, constants.R_OK | constants.W_OK);
    } catch (error) {
      throw new Error(
        `Cannot access workspace directory: ${this.workspacePath}. ` +
        `Please ensure the directory exists and has read/write permissions. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Check if in protected directories
    const homedir = os.homedir();
    const protectedPaths = [
      homedir,
      path.join(homedir, "Desktop"),
      path.join(homedir, "Documents"),
      path.join(homedir, "Downloads")
    ];

    if (protectedPaths.includes(this.workspacePath)) {
      const dirName = path.basename(this.workspacePath);
      throw new Error(`Cannot use checkpoints in ${dirName} directory`);
    }
  }

  private async validateStoragePath(): Promise<void> {
    try {
      // Try to access, if it doesn't exist, mkdir will be called later
      await access(this.storagePath, constants.R_OK | constants.W_OK);
    } catch (error) {
      // Directory might not exist yet, that's ok
      console.log(`Storage directory will be created at: ${this.storagePath}`);
    }
  }
}