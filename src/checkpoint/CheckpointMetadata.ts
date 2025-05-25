import fs from "fs/promises";
import * as path from "path";
import type { CheckpointMetadata } from "../types.js";

/**
 * Manages checkpoint metadata storage and retrieval
 */
export class CheckpointMetadataStore {
  private storagePath: string;
  private metadataFile: string;

  constructor(storagePath: string, workspaceHash: string) {
    this.storagePath = storagePath;
    this.metadataFile = path.join(storagePath, "checkpoints", workspaceHash, "metadata.json");
  }

  /**
   * Loads checkpoint metadata from storage
   */
  async loadMetadata(): Promise<CheckpointMetadata[]> {
    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(this.metadataFile), { recursive: true });
      
      const data = await fs.readFile(this.metadataFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, return empty array
      return [];
    }
  }

  /**
   * Saves checkpoint metadata to storage
   */
  async saveMetadata(metadata: CheckpointMetadata[]): Promise<void> {
    await fs.mkdir(path.dirname(this.metadataFile), { recursive: true });
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
  }

  /**
   * Adds a new checkpoint to metadata
   */
  async addCheckpoint(checkpoint: CheckpointMetadata): Promise<void> {
    const metadata = await this.loadMetadata();
    metadata.push(checkpoint);
    await this.saveMetadata(metadata);
  }

  /**
   * Gets a specific checkpoint by ID
   */
  async getCheckpoint(checkpointId: string): Promise<CheckpointMetadata | undefined> {
    const metadata = await this.loadMetadata();
    return metadata.find(cp => cp.id === checkpointId);
  }

  /**
   * Gets all checkpoints sorted by timestamp (newest first)
   */
  async getAllCheckpoints(): Promise<CheckpointMetadata[]> {
    const metadata = await this.loadMetadata();
    return metadata.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Gets the latest checkpoint
   */
  async getLatestCheckpoint(): Promise<CheckpointMetadata | undefined> {
    const metadata = await this.getAllCheckpoints();
    return metadata[0];
  }

  /**
   * Removes checkpoints older than the specified number of days
   */
  async cleanupOldCheckpoints(maxAgeInDays: number = 30): Promise<number> {
    const metadata = await this.loadMetadata();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

    const originalCount = metadata.length;
    const filteredMetadata = metadata.filter(cp => 
      new Date(cp.timestamp) > cutoffDate
    );

    if (filteredMetadata.length !== originalCount) {
      await this.saveMetadata(filteredMetadata);
    }

    return originalCount - filteredMetadata.length;
  }
}