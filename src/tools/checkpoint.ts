import { z } from "zod";
import CheckpointTracker from "../checkpoint/CheckpointTracker.js";
import { CheckpointMetadataStore } from "../checkpoint/CheckpointMetadata.js";
import { CheckpointConfig } from "../config.js";
import { generateId } from "../utils.js";
import { DebugLogger } from "../debug-logger.js";
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
    
    // Clear debug log for clean debugging session
    await DebugLogger.clear();
    
    // Count actual changed files BEFORE staging operations to get accurate count
    await DebugLogger.info("=== CHECKPOINT CREATION START ===");
    await DebugLogger.info("Calculating actual changed files before staging...");
    const changedFilesList = await tracker.getActualChangedFiles();
    const detectedCount = changedFilesList.length;
    await DebugLogger.info(`Actual files detected: ${detectedCount}`);
    await DebugLogger.info(`Changed files list:`, changedFilesList);
    
    // TEMPORARY DEBUG: Force the count to match what we actually detected
    // This will help us isolate if the issue is in detection vs storage
    const filesChanged = detectedCount;
    await DebugLogger.warn(`DEBUG: Forcing file count to detected count: ${filesChanged}`);
    
    const commitHash = await tracker.commit();
    if (!commitHash) {
      throw new Error("Failed to create checkpoint commit");
    }

    // Create checkpoint metadata
    const checkpointId = generateId();
    const timestamp = new Date().toISOString();

    // Save checkpoint metadata
    await DebugLogger.info(`About to save checkpoint metadata with filesChanged: ${filesChanged}`);
    await metadataStore.addCheckpoint({
      id: checkpointId,
      timestamp,
      message: args.message,
      commitHash,
      filesChanged,
      workspaceHash: workspaceInfo.cwdHash
    });

    await DebugLogger.info(`Checkpoint created: ${checkpointId} (${commitHash})`);
    await DebugLogger.info(`=== CHECKPOINT CREATION END ===`);

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