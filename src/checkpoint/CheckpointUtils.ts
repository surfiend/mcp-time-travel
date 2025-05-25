import { mkdir, access, constants } from "fs/promises";
import * as path from "path";
import os from "os";

/**
 * Gets the path to the shadow Git repository in storage.
 *
 * Checkpoints path structure:
 * storage/
 *   checkpoints/
 *     {cwdHash}/
 *       .git/
 *
 * @param storagePath - The checkpoint storage path
 * @param taskId - The ID of the task
 * @param cwdHash - Hash of the working directory path
 * @returns Promise<string> The absolute path to the shadow git directory
 * @throws Error if storage path is invalid
 */
export async function getShadowGitPath(storagePath: string, taskId: string, cwdHash: string): Promise<string> {
  if (!storagePath) {
    throw new Error("Storage path is invalid");
  }
  const checkpointsDir = path.join(storagePath, "checkpoints", cwdHash);
  await mkdir(checkpointsDir, { recursive: true });
  const gitPath = path.join(checkpointsDir, ".git");
  return gitPath;
}

/**
 * Gets the current working directory from configuration.
 * Validates that checkpoints are not being used in protected directories
 * like home, Desktop, Documents, or Downloads. Checks to confirm that the workspace
 * is accessible and that we will not encounter breaking permissions issues when
 * creating checkpoints.
 *
 * Protected directories:
 * - User's home directory
 * - Desktop
 * - Documents
 * - Downloads
 *
 * @param workspacePath - The configured workspace path
 * @returns Promise<string> The absolute path to the current working directory
 * @throws Error if no workspace is detected, if in a protected directory, or if no read access
 */
export async function getWorkingDirectory(workspacePath: string): Promise<string> {
  if (!workspacePath) {
    throw new Error("No workspace path provided. Please set CHECKPOINT_WORKSPACE_PATH environment variable.");
  }

  const cwd = path.resolve(workspacePath);

  // Check if directory exists and we have read permissions
  try {
    await access(cwd, constants.R_OK);
  } catch (error) {
    throw new Error(
      `Cannot access workspace directory. Please ensure the path exists and has read permissions. Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const homedir = os.homedir();
  const desktopPath = path.join(homedir, "Desktop");
  const documentsPath = path.join(homedir, "Documents");
  const downloadsPath = path.join(homedir, "Downloads");

  switch (cwd) {
    case homedir:
      throw new Error("Cannot use checkpoints in home directory");
    case desktopPath:
      throw new Error("Cannot use checkpoints in Desktop directory");
    case documentsPath:
      throw new Error("Cannot use checkpoints in Documents directory");
    case downloadsPath:
      throw new Error("Cannot use checkpoints in Downloads directory");
    default:
      return cwd;
  }
}

/**
 * Hashes the current working directory to a 13-character numeric hash.
 * @param workingDir - The absolute path to the working directory
 * @returns A 13-character numeric hash string used to identify the workspace
 * @throws {Error} If the working directory path is empty or invalid
 */
export function hashWorkingDir(workingDir: string): string {
  if (!workingDir) {
    throw new Error("Working directory path cannot be empty");
  }
  let hash = 0;
  for (let i = 0; i < workingDir.length; i++) {
    hash = (hash * 31 + workingDir.charCodeAt(i)) >>> 0;
  }
  const bigHash = BigInt(hash);
  const numericHash = bigHash.toString().slice(0, 13);
  return numericHash;
}

/**
 * Checks if a file exists at the given path
 * @param filePath - Path to check
 * @returns Promise<boolean> True if file exists
 */
export async function fileExistsAtPath(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}