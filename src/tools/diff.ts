import { z } from "zod";
import CheckpointTracker from "../checkpoint/CheckpointTracker.js";
import { CheckpointMetadataStore } from "../checkpoint/CheckpointMetadata.js";
import { CheckpointConfig } from "../config.js";
import { hashWorkingDir } from "../checkpoint/CheckpointUtils.js";
import { generateId, truncateText } from "../utils.js";
import type { CheckpointDiff } from "../types.js";

export const ShowDiffSchema = z.object({
  fromCheckpoint: z.string().describe("The ID of the checkpoint to compare from"),
  toCheckpoint: z.string().optional().describe("The ID of the checkpoint to compare to (optional, defaults to current state)")
});

export interface DiffResult {
  fromCheckpointId: string;
  toCheckpointId?: string;
  totalFiles: number;
  changes: DiffEntry[];
}

export interface DiffEntry {
  relativePath: string;
  changeType: 'added' | 'modified' | 'deleted';
  beforeSize: number;
  afterSize: number;
  beforePreview?: string;
  afterPreview?: string;
}

export async function showDiff(args: z.infer<typeof ShowDiffSchema>): Promise<DiffResult> {
  const config = new CheckpointConfig();
  await config.validate();

  const workspaceHash = hashWorkingDir(config.workspacePath);
  const metadataStore = new CheckpointMetadataStore(config.storagePath, workspaceHash);
  
  try {
    // Find the from checkpoint
    const fromCheckpoint = await metadataStore.getCheckpoint(args.fromCheckpoint);
    if (!fromCheckpoint) {
      throw new Error(`Checkpoint not found: ${args.fromCheckpoint}`);
    }

    let toCheckpoint;
    if (args.toCheckpoint) {
      toCheckpoint = await metadataStore.getCheckpoint(args.toCheckpoint);
      if (!toCheckpoint) {
        throw new Error(`Checkpoint not found: ${args.toCheckpoint}`);
      }
    }

    console.info(`Generating diff from ${args.fromCheckpoint} to ${args.toCheckpoint || 'current state'}`);

    // Create a tracker instance to perform the diff
    const taskId = generateId();
    const tracker = await CheckpointTracker.create(taskId, config.storagePath, config.workspacePath);
    
    // Get the diff data
    const diffData = await tracker.getDiffSet(
      fromCheckpoint.commitHash,
      toCheckpoint?.commitHash
    );

    // Process the diff data into a more structured format
    const changes: DiffEntry[] = diffData.map(diff => {
      const beforeSize = diff.before.length;
      const afterSize = diff.after.length;
      
      let changeType: 'added' | 'modified' | 'deleted';
      if (beforeSize === 0) {
        changeType = 'added';
      } else if (afterSize === 0) {
        changeType = 'deleted';
      } else {
        changeType = 'modified';
      }

      // Create previews for text files (limit to first few lines)
      const beforePreview = createPreview(diff.before);
      const afterPreview = createPreview(diff.after);

      return {
        relativePath: diff.relativePath,
        changeType,
        beforeSize,
        afterSize,
        beforePreview,
        afterPreview
      };
    });

    const result: DiffResult = {
      fromCheckpointId: args.fromCheckpoint,
      toCheckpointId: args.toCheckpoint,
      totalFiles: changes.length,
      changes
    };

    console.info(`Diff generated: ${changes.length} files changed`);
    return result;
  } catch (error) {
    console.error("Failed to generate diff:", error);
    throw new Error(`Failed to generate diff: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function createPreview(content: string, maxLines: number = 5, maxLength: number = 200): string | undefined {
  if (!content || content.length === 0) {
    return undefined;
  }

  // Check if content appears to be binary
  if (isBinaryContent(content)) {
    return '[Binary content]';
  }

  const lines = content.split('\n');
  const previewLines = lines.slice(0, maxLines);
  let preview = previewLines.join('\n');
  
  if (preview.length > maxLength) {
    preview = truncateText(preview, maxLength);
  }
  
  if (lines.length > maxLines) {
    preview += `\n... (${lines.length - maxLines} more lines)`;
  }
  
  return preview;
}

function isBinaryContent(content: string): boolean {
  // Simple heuristic: if content contains null bytes or has a high ratio of non-printable characters
  if (content.includes('\0')) {
    return true;
  }
  
  const nonPrintableCount = (content.match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g) || []).length;
  const ratio = nonPrintableCount / content.length;
  return ratio > 0.1; // If more than 10% non-printable, consider it binary
}