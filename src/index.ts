#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCheckpointServer } from "./server.js";

async function main() {
  try {
    console.error("Starting MCP Checkpoint Server...");
    
    // Validate environment and configuration
    const { CheckpointConfig } = await import("./config.js");
    const config = new CheckpointConfig();
    await config.validate();
    
    console.error(`Workspace: ${config.workspacePath}`);
    console.error(`Storage: ${config.storagePath}`);
    
    // Create and start the server
    const server = createCheckpointServer();
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    console.error("MCP Checkpoint Server running on stdio");
    
  } catch (error) {
    console.error("Failed to start MCP Checkpoint Server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error("Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error("Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});