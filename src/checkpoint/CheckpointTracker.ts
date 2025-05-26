import fs from "fs/promises";
import * as path from "path";
import simpleGit from "simple-git";
import { GitOperations } from "./CheckpointGitOperations.js";
import { getShadowGitPath, getWorkingDirectory, hashWorkingDir } from "./CheckpointUtils.js";
import type { CheckpointDiff } from "../types.js";

/**
 * CheckpointTracker Module
 *
 * Core implementation of the Checkpoints system that provides version control
 * capabilities without interfering with the user's main Git repository. Key features:
 *
 * Shadow Git Repository:
 * - Creates and manages an isolated Git repository for tracking checkpoints
 * - Handles nested Git repositories by temporarily disabling them
 * - Configures Git settings automatically (identity, LFS, etc.)
 *
 * File Management:
 * - Integrates with CheckpointExclusions for file filtering
 * - Handles workspace validation and path resolution
 * - Manages Git worktree configuration
 *
 * Checkpoint Operations:
 * - Creates checkpoints (commits) of the current state
 * - Provides diff capabilities between checkpoints
 * - Supports resetting to previous checkpoints
 *
 * Safety Features:
 * - Prevents usage in sensitive directories (home, desktop, etc.)
 * - Validates workspace configuration
 * - Handles cleanup and resource disposal
 *
 * Checkpoint Architecture:
 * - Unique shadow git repository for each workspace
 * - Workspaces are identified by name, and hashed to a unique number
 * - All commits for a workspace are stored in one shadow git, under a single branch
 */

class CheckpointTracker {
  private storagePath: string;
  private taskId: string;
  private cwd: string;
  private cwdHash: string;
  private lastRetrievedShadowGitConfigWorkTree?: string;
  private gitOperations: GitOperations;

  /**
   * Helper method to clean commit hashes that might have a "HEAD " prefix.
   * Used for backward compatibility with old tasks that stored hashes with the prefix.
   */
  private cleanCommitHash(hash: string): string {
    return hash.startsWith("HEAD ") ? hash.slice(5) : hash;
  }

  /**
   * Creates a new CheckpointTracker instance to manage checkpoints for a specific task.
   * The constructor is private - use the static create() method to instantiate.
   *
   * @param taskId - Unique identifier for the task being tracked
   * @param cwd - The current working directory to track files in
   * @param cwdHash - Hash of the working directory path for shadow git organization
   * @param storagePath - Path to store checkpoint data
   */
  private constructor(storagePath: string, taskId: string, cwd: string, cwdHash: string) {
    this.storagePath = storagePath;
    this.taskId = taskId;
    this.cwd = cwd;
    this.cwdHash = cwdHash;
    this.gitOperations = new GitOperations(cwd);
  }

  /**
   * Creates a new CheckpointTracker instance for tracking changes in a task.
   * Handles initialization of the shadow git repository.
   *
   * @param taskId - Unique identifier for the task to track
   * @param storagePath - Storage path for checkpoint data
   * @param workspacePath - Workspace path to track
   * @returns Promise resolving to new CheckpointTracker instance
   * @throws Error if:
   * - storagePath is not supplied
   * - Git is not installed
   * - Working directory is invalid or in a protected location
   * - Shadow git initialization fails
   *
   * Key operations:
   * - Validates git installation and settings
   * - Creates/initializes shadow git repository
   */
  public static async create(
    taskId: string,
    storagePath: string,
    workspacePath: string,
  ): Promise<CheckpointTracker> {
    if (!storagePath) {
      throw new Error("Storage path is required to create a checkpoint tracker");
    }
    try {
      console.info(`Creating new CheckpointTracker for task ${taskId}`);
      const startTime = performance.now();

      // Check if git is installed by attempting to get version
      try {
        await simpleGit().version();
      } catch (error) {
        throw new Error("Git must be installed to use checkpoints.");
      }

      const workingDir = await getWorkingDirectory(workspacePath);
      const cwdHash = hashWorkingDir(workingDir);
      console.debug(`Repository ID (cwdHash): ${cwdHash}`);

      const newTracker = new CheckpointTracker(storagePath, taskId, workingDir, cwdHash);

      const gitPath = await getShadowGitPath(newTracker.storagePath, newTracker.taskId, newTracker.cwdHash);
      await newTracker.gitOperations.initShadowGit(gitPath, workingDir, taskId);

      const durationMs = Math.round(performance.now() - startTime);
      console.info(`CheckpointTracker created in ${durationMs}ms`);

      return newTracker;
    } catch (error) {
      console.error("Failed to create CheckpointTracker:", error);
      throw error;
    }
  }

  /**
   * Creates a new checkpoint commit in the shadow git repository.
   *
   * Key behaviors:
   * - Creates commit with checkpoint files in shadow git repo
   * - Caches the created commit hash
   *
   * Commit structure:
   * - Commit message: "checkpoint-{cwdHash}-{taskId}"
   * - Always allows empty commits
   *
   * Dependencies:
   * - Requires initialized shadow git (getShadowGitPath)
   * - Uses addCheckpointFiles to stage changes using 'git add .'
   * - Relies on git's native exclusion handling via the exclude file
   *
   * @returns Promise<string | undefined> The created commit hash, or undefined if:
   * - Shadow git access fails
   * - Staging files fails
   * - Commit creation fails
   * @throws Error if unable to:
   * - Access shadow git path
   * - Initialize simple-git
   * - Stage or commit files
   */
  public async commit(): Promise<string | undefined> {
    try {
      console.info(`Creating new checkpoint commit for task ${this.taskId}`);
      const startTime = performance.now();

      const gitPath = await getShadowGitPath(this.storagePath, this.taskId, this.cwdHash);
      // Use workspace as working directory, but point to shadow git
      const git = simpleGit(this.cwd, { baseDir: this.cwd, binary: 'git' })
        .env('GIT_DIR', gitPath)
        .env('GIT_WORK_TREE', this.cwd);

      console.info(`Using shadow git at: ${gitPath}`);

      const addFilesResult = await this.gitOperations.addCheckpointFiles(git);
      if (!addFilesResult.success) {
        console.error("Failed to add at least one file(s) to checkpoints shadow git");
      }

      const commitMessage = "checkpoint-" + this.cwdHash + "-" + this.taskId;

      console.info(`Creating checkpoint commit with message: ${commitMessage}`);
      const result = await git.commit(commitMessage, {
        "--allow-empty": null,
        "--no-verify": null,
      });
      const commitHash = (result.commit || "").replace(/^HEAD\s+/, "");
      console.warn(`Checkpoint commit created: `, commitHash);

      const durationMs = Math.round(performance.now() - startTime);
      console.info(`Checkpoint commit created in ${durationMs}ms`);

      return commitHash;
    } catch (error) {
      console.error("Failed to create checkpoint:", {
        taskId: this.taskId,
        error,
      });
      throw new Error(`Failed to create checkpoint: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieves the worktree path from the shadow git configuration.
   * The worktree path indicates where the shadow git repository is tracking files,
   * which should match the current workspace directory.
   *
   * Key behaviors:
   * - Caches result in lastRetrievedShadowGitConfigWorkTree to avoid repeated reads
   * - Returns cached value if available
   * - Reads git config if no cached value exists
   *
   * Configuration read:
   * - Uses simple-git to read core.worktree config
   * - Operates on shadow git at path from getShadowGitPath()
   *
   * @returns Promise<string | undefined> The configured worktree path, or undefined if:
   * - Shadow git repository doesn't exist
   * - Config read fails
   * - No worktree is configured
   * @throws Error if unable to:
   * - Access shadow git path
   * - Initialize simple-git
   * - Read git configuration
   */
  public async getShadowGitConfigWorkTree(): Promise<string | undefined> {
    if (this.lastRetrievedShadowGitConfigWorkTree) {
      return this.lastRetrievedShadowGitConfigWorkTree;
    }
    try {
      const gitPath = await getShadowGitPath(this.storagePath, this.taskId, this.cwdHash);
      this.lastRetrievedShadowGitConfigWorkTree = await this.gitOperations.getShadowGitConfigWorkTree(gitPath);
      return this.lastRetrievedShadowGitConfigWorkTree;
    } catch (error) {
      console.error("Failed to get shadow git config worktree:", error);
      return undefined;
    }
  }

  /**
   * Resets the shadow git repository's HEAD to a specific checkpoint commit.
   * This will discard all changes after the target commit and restore the
   * working directory to that checkpoint's state.
   *
   * Dependencies:
   * - Requires initialized shadow git (getShadowGitPath)
   * - Must be called with a valid commit hash from this task's history
   *
   * @param commitHash - The hash of the checkpoint commit to reset to
   * @returns Promise<void> Resolves when reset is complete
   * @throws Error if unable to:
   * - Access shadow git path
   * - Initialize simple-git
   * - Reset to target commit
   */
  public async resetHead(commitHash: string): Promise<void> {
    console.info(`Resetting to checkpoint: ${commitHash}`);
    const startTime = performance.now();

    const gitPath = await getShadowGitPath(this.storagePath, this.taskId, this.cwdHash);
    const git = simpleGit(this.cwd, { baseDir: this.cwd, binary: 'git' })
      .env('GIT_DIR', gitPath)
      .env('GIT_WORK_TREE', this.cwd);
    console.debug(`Using shadow git at: ${gitPath}`);
    await git.reset(["--hard", this.cleanCommitHash(commitHash)]); // Hard reset to target commit
    console.debug(`Successfully reset to checkpoint: ${commitHash}`);

    const durationMs = Math.round(performance.now() - startTime);
    console.info(`Reset completed in ${durationMs}ms`);
  }

  /**
   * Return an array describing changed files between one commit and either:
   *   - another commit, or
   *   - the current working directory (including uncommitted changes).
   *
   * If `rhsHash` is omitted, compares `lhsHash` to the working directory.
   * If you want truly untracked files to appear, `git add` them first.
   *
   * @param lhsHash - The commit to compare from (older commit)
   * @param rhsHash - The commit to compare to (newer commit).
   *                  If omitted, we compare to the working directory.
   * @returns Array of file changes with before/after content
   */
  public async getDiffSet(
    lhsHash: string,
    rhsHash?: string,
  ): Promise<CheckpointDiff[]> {
    const startTime = performance.now();

    const gitPath = await getShadowGitPath(this.storagePath, this.taskId, this.cwdHash);
    const git = simpleGit(this.cwd, { baseDir: this.cwd, binary: 'git' })
      .env('GIT_DIR', gitPath)
      .env('GIT_WORK_TREE', this.cwd);

    console.info(`Getting diff between commits: ${lhsHash || "initial"} -> ${rhsHash || "working directory"}`);

    // Stage all changes so that untracked files appear in diff summary
    await this.gitOperations.addCheckpointFiles(git);

    const cleanLhs = this.cleanCommitHash(lhsHash);
    const cleanRhs = rhsHash ? this.cleanCommitHash(rhsHash) : undefined;
    
    // For git diff between commits, pass them as separate arguments, not with ".."
    const diffSummary = cleanRhs 
      ? await git.diffSummary([cleanLhs, cleanRhs])
      : await git.diffSummary([cleanLhs]);

    const result = [];
    for (const file of diffSummary.files) {
      const filePath = file.file;
      const absolutePath = path.join(this.cwd, filePath);

      let beforeContent = "";
      try {
        beforeContent = await git.show([`${this.cleanCommitHash(lhsHash)}:${filePath}`]);
      } catch (_) {
        // file didn't exist in older commit => remains empty
      }

      let afterContent = "";
      if (rhsHash) {
        try {
          afterContent = await git.show([`${this.cleanCommitHash(rhsHash)}:${filePath}`]);
        } catch (_) {
          // file didn't exist in newer commit => remains empty
        }
      } else {
        try {
          afterContent = await fs.readFile(absolutePath, "utf8");
        } catch (_) {
          // file might be deleted => remains empty
        }
      }

      result.push({
        relativePath: filePath,
        absolutePath,
        before: beforeContent,
        after: afterContent,
      });
    }

    const durationMs = Math.round(performance.now() - startTime);
    console.info(`Diff generated in ${durationMs}ms`);

    return result;
  }

  /**
   * Returns the number of files changed between two commits.
   *
   * @param lhsHash - The commit to compare from (older commit)
   * @param rhsHash - The commit to compare to (newer commit).
   *                  If omitted, we compare to the working directory.
   * @returns The number of files changed between the commits
   */
  public async getDiffCount(lhsHash: string, rhsHash?: string): Promise<number> {
    const startTime = performance.now();

    const gitPath = await getShadowGitPath(this.storagePath, this.taskId, this.cwdHash);
    const git = simpleGit(this.cwd, { baseDir: this.cwd, binary: 'git' })
      .env('GIT_DIR', gitPath)
      .env('GIT_WORK_TREE', this.cwd);

    console.info(`Getting diff count between commits: ${lhsHash || "initial"} -> ${rhsHash || "working directory"}`);

    // Stage all changes so that untracked files appear in diff summary
    await this.gitOperations.addCheckpointFiles(git);

    const cleanLhs = this.cleanCommitHash(lhsHash);
    const cleanRhs = rhsHash ? this.cleanCommitHash(rhsHash) : undefined;
    
    // For git diff between commits, pass them as separate arguments, not with ".."
    const diffSummary = cleanRhs 
      ? await git.diffSummary([cleanLhs, cleanRhs])
      : await git.diffSummary([cleanLhs]);


    const durationMs = Math.round(performance.now() - startTime);
    console.info(`Diff count generated in ${durationMs}ms`);

    return diffSummary.files.length;
  }

  /**
   * Gets the commit log for the current shadow git repository
   * @param maxCount - Maximum number of commits to return
   * @returns Array of commit objects
   */
  public async getCommitLog(maxCount: number = 50) {
    const gitPath = await getShadowGitPath(this.storagePath, this.taskId, this.cwdHash);
    const git = simpleGit(this.cwd, { baseDir: this.cwd, binary: 'git' })
      .env('GIT_DIR', gitPath)
      .env('GIT_WORK_TREE', this.cwd);
    
    const log = await git.log({ maxCount });
    return log.all;
  }

  /**
   * Get workspace metadata
   */
  public getWorkspaceInfo() {
    return {
      cwd: this.cwd,
      cwdHash: this.cwdHash,
      taskId: this.taskId,
      storagePath: this.storagePath
    };
  }
}

export default CheckpointTracker;