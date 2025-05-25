import { z } from "zod";
import CheckpointTracker from "../checkpoint/CheckpointTracker.js";
import { CheckpointMetadataStore } from "../checkpoint/CheckpointMetadata.js";
import { CheckpointConfig } from "../config.js";
import { hashWorkingDir } from "../checkpoint/CheckpointUtils.js";
import { generateId } from "../utils.js";
import type { RollbackResult } from "../types.js";

export const RollbackCheckpointSchema = z.object({
  checkpointId: z.string().describe("The ID of the checkpoint to rollback to")
});

export async function rollbackCheckpoint(args: z.infer<typeof RollbackCheckpointSchema>): Promise<RollbackResult> {
  const config = new CheckpointConfig();
  await config.validate();

  const workspaceHash = hashWorkingDir(config.workspacePath);
  const metadataStore = new CheckpointMetadataStore(config.storagePath, workspaceHash);
  
  try {
    // Find the target checkpoint
    const targetCheckpoint = await metadataStore.getCheckpoint(args.checkpointId);
    if (!targetCheckpoint) {
      throw new Error(`Checkpoint not found: ${args.checkpointId}`);
    }

    console.info(`Rolling back to checkpoint: ${args.checkpointId} (${targetCheckpoint.commitHash})`);

    // Create a tracker instance to perform the rollback
    const taskId = generateId();
    const tracker = await CheckpointTracker.create(taskId, config.storagePath, config.workspacePath);
    
    // Get current state before rollback to calculate files restored
    const currentCheckpoint = await metadataStore.getLatestCheckpoint();
    let filesRestored = 0;
    
    if (currentCheckpoint && currentCheckpoint.id !== args.checkpointId) {
      // Calculate the number of files that will be restored
      filesRestored = await tracker.getDiffCount(targetCheckpoint.commitHash, currentCheckpoint.commitHash);
    }

    // Perform the rollback
    await tracker.resetHead(targetCheckpoint.commitHash);
    
    const result: RollbackResult = {
      success: true,
      filesRestored,
      message: `Successfully rolled back to checkpoint "${targetCheckpoint.message || 'Unnamed'}" from ${new Date(targetCheckpoint.timestamp).toLocaleString()}`,
      checkpointId: args.checkpointId
    };

    console.info(`Rollback completed successfully. Files restored: ${filesRestored}`);
    return result;
  } catch (error) {
    console.error("Failed to rollback checkpoint:", error);
    
    const result: RollbackResult = {
      success: false,
      filesRestored: 0,
      message: `Failed to rollback to checkpoint: ${error instanceof Error ? error.message : String(error)}`,
      checkpointId: args.checkpointId
    };
    
    return result;
  }
}