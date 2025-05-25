import { z } from "zod";
import { CheckpointMetadataStore } from "../checkpoint/CheckpointMetadata.js";
import { CheckpointConfig } from "../config.js";
import { hashWorkingDir } from "../checkpoint/CheckpointUtils.js";
import { formatTimestamp } from "../utils.js";
import type { CheckpointStatus } from "../types.js";

export const CheckpointStatusSchema = z.object({});

export async function checkpointStatus(args: z.infer<typeof CheckpointStatusSchema>): Promise<CheckpointStatus> {
  const config = new CheckpointConfig();
  await config.validate();

  const workspaceHash = hashWorkingDir(config.workspacePath);
  const metadataStore = new CheckpointMetadataStore(config.storagePath, workspaceHash);
  
  try {
    const allCheckpoints = await metadataStore.getAllCheckpoints();
    const latestCheckpoint = allCheckpoints[0]; // They're sorted by timestamp desc

    const status: CheckpointStatus = {
      currentCheckpoint: latestCheckpoint ? `${latestCheckpoint.id} (${formatTimestamp(latestCheckpoint.timestamp)})` : undefined,
      totalCheckpoints: allCheckpoints.length,
      workspaceHash,
      workspacePath: config.workspacePath,
      storagePath: config.storagePath
    };

    console.info(`Status retrieved: ${allCheckpoints.length} checkpoints, latest: ${latestCheckpoint?.id || 'none'}`);
    return status;
  } catch (error) {
    console.error("Failed to get checkpoint status:", error);
    throw new Error(`Failed to get checkpoint status: ${error instanceof Error ? error.message : String(error)}`);
  }
}