import { z } from "zod";
import CheckpointTracker from "../checkpoint/CheckpointTracker.js";
import { CheckpointMetadataStore } from "../checkpoint/CheckpointMetadata.js";
import { CheckpointConfig } from "../config.js";
import { generateId } from "../utils.js";
import type { CreateCheckpointResult } from "../types.js";

export const CreateCheckpointSchema = z.object({
  message: z.string().optional().describe("Optional description for the checkpoint")
});

export async function createCheckpoint(args: z.infer<typeof CreateCheckpointSchema>): Promise<CreateCheckpointResult> {
  const config = new CheckpointConfig();
  await config.validate();

  const taskId = generateId();
  const tracker = await CheckpointTracker.create(taskId, config.storagePath, config.workspacePath);
  
  try {
    const commitHash = await tracker.commit();
    if (!commitHash) {
      throw new Error("Failed to create checkpoint commit");
    }

    // Get workspace info for metadata
    const workspaceInfo = tracker.getWorkspaceInfo();
    
    // Create checkpoint metadata
    const checkpointId = generateId();
    const timestamp = new Date().toISOString();
    
    // Get number of changed files (compare to latest checkpoint or initial)
    const metadataStore = new CheckpointMetadataStore(config.storagePath, workspaceInfo.cwdHash);
    const latestCheckpoint = await metadataStore.getLatestCheckpoint();
    
    let filesChanged = 0;
    if (latestCheckpoint) {
      filesChanged = await tracker.getDiffCount(latestCheckpoint.commitHash);
    } else {
      // For the first checkpoint, count all tracked files
      const log = await tracker.getCommitLog(1);
      if (log.length > 0) {
        // This is a rough estimate - in practice we'd need to count the files in the initial commit
        filesChanged = 1; // Placeholder for initial commit
      }
    }

    // Save checkpoint metadata
    await metadataStore.addCheckpoint({
      id: checkpointId,
      timestamp,
      message: args.message,
      commitHash,
      filesChanged,
      workspaceHash: workspaceInfo.cwdHash
    });

    console.info(`Checkpoint created: ${checkpointId} (${commitHash})`);

    return {
      checkpointId,
      timestamp,
      filesChanged,
      commitHash
    };
  } catch (error) {
    console.error("Failed to create checkpoint:", error);
    throw new Error(`Failed to create checkpoint: ${error instanceof Error ? error.message : String(error)}`);
  }
}