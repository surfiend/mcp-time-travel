import { z } from "zod";
import { CheckpointMetadataStore } from "../checkpoint/CheckpointMetadata.js";
import { CheckpointConfig } from "../config.js";
import { hashWorkingDir } from "../checkpoint/CheckpointUtils.js";
import { formatTimestamp, getTimeDifference, truncateText } from "../utils.js";
import type { CheckpointMetadata } from "../types.js";

export const ShowTimelineSchema = z.object({
  limit: z.number().optional().describe("Maximum number of checkpoints to show (default: 20)")
});

export interface TimelineEntry {
  id: string;
  timestamp: string;
  formattedTimestamp: string;
  timeAgo: string;
  message?: string;
  filesChanged: number;
  commitHash: string;
}

export async function showTimeline(args: z.infer<typeof ShowTimelineSchema>): Promise<TimelineEntry[]> {
  const config = new CheckpointConfig();
  await config.validate();

  const workspaceHash = hashWorkingDir(config.workspacePath);
  const metadataStore = new CheckpointMetadataStore(config.storagePath, workspaceHash);
  
  try {
    const allCheckpoints = await metadataStore.getAllCheckpoints();
    const limit = args.limit || 20;
    const checkpoints = allCheckpoints.slice(0, limit);
    
    if (checkpoints.length === 0) {
      return [];
    }

    const now = new Date().toISOString();
    
    const timeline: TimelineEntry[] = checkpoints.map(checkpoint => ({
      id: checkpoint.id,
      timestamp: checkpoint.timestamp,
      formattedTimestamp: formatTimestamp(checkpoint.timestamp),
      timeAgo: getTimeDifference(checkpoint.timestamp, now),
      message: checkpoint.message ? truncateText(checkpoint.message, 80) : undefined,
      filesChanged: checkpoint.filesChanged,
      commitHash: checkpoint.commitHash.substring(0, 7) // Short hash for display
    }));

    console.info(`Retrieved ${timeline.length} checkpoints from timeline`);
    return timeline;
  } catch (error) {
    console.error("Failed to retrieve timeline:", error);
    throw new Error(`Failed to retrieve timeline: ${error instanceof Error ? error.message : String(error)}`);
  }
}