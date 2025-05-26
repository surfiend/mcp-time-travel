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
    // Get workspace info for metadata
    const workspaceInfo = tracker.getWorkspaceInfo();
    
    // Get the latest checkpoint BEFORE creating the new commit
    const metadataStore = new CheckpointMetadataStore(config.storagePath, workspaceInfo.cwdHash);
    const latestCheckpoint = await metadataStore.getLatestCheckpoint();
    
    const commitHash = await tracker.commit();
    if (!commitHash) {
      throw new Error("Failed to create checkpoint commit");
    }

    // Create checkpoint metadata
    const checkpointId = generateId();
    const timestamp = new Date().toISOString();
    
    let filesChanged = 0;
    if (latestCheckpoint) {
      // Compare from previous checkpoint to the new commit we just created
      console.info(`Calculating diff between previous checkpoint ${latestCheckpoint.commitHash} and new commit ${commitHash}`);
      
      // Safeguard: if the commits are the same, this might indicate no changes were made
      if (latestCheckpoint.commitHash === commitHash) {
        console.warn(`Warning: New commit hash is same as previous checkpoint - no changes detected`);
        filesChanged = 0;
      } else {
        filesChanged = await tracker.getDiffCount(latestCheckpoint.commitHash, commitHash);
      }
      console.info(`Files changed in this checkpoint: ${filesChanged}`);
    } else {
      // For the first checkpoint, count all tracked files in the initial commit
      console.info(`First checkpoint - comparing against empty tree to commit ${commitHash}`);
      const diffSummary = await tracker.getDiffCount("4b825dc642cb6eb9a060e54bf8d69288fbee4904", commitHash); // empty tree hash
      filesChanged = diffSummary;
      console.info(`Files in first checkpoint: ${filesChanged}`);
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