import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import tool functions
import { createCheckpoint, CreateCheckpointSchema } from "./tools/checkpoint.js";
import { showTimeline, ShowTimelineSchema } from "./tools/timeline.js";
import { rollbackCheckpoint, RollbackCheckpointSchema } from "./tools/rollback.js";
import { showDiff, ShowDiffSchema } from "./tools/diff.js";
import { checkpointStatus, CheckpointStatusSchema } from "./tools/status.js";
import { viewDebugLog, ViewDebugLogSchema, clearDebugLog, ClearDebugLogSchema } from "./tools/debug.js";

export function createCheckpointServer() {
  const server = new Server({
    name: "checkpoint-server",
    version: "0.1.0",
  }, {
    capabilities: {
      tools: {},
    },
  });

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "create_checkpoint",
          description: "Create a new checkpoint of the current workspace state",
          inputSchema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "Optional description for the checkpoint"
              },
            },
          },
        },
        {
          name: "show_timeline",
          description: "Show a chronological timeline of all checkpoints",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of checkpoints to show (default: 20)"
              },
            },
          },
        },
        {
          name: "rollback_checkpoint",
          description: "Rollback the workspace to a previous checkpoint state",
          inputSchema: {
            type: "object",
            properties: {
              checkpointId: {
                type: "string",
                description: "The ID of the checkpoint to rollback to"
              },
            },
            required: ["checkpointId"],
          },
        },
        {
          name: "show_diff",
          description: "Show differences between two checkpoints or between a checkpoint and current state",
          inputSchema: {
            type: "object",
            properties: {
              fromCheckpoint: {
                type: "string",
                description: "The ID of the checkpoint to compare from"
              },
              toCheckpoint: {
                type: "string",
                description: "The ID of the checkpoint to compare to (optional, defaults to current state)"
              },
            },
            required: ["fromCheckpoint"],
          },
        },
        {
          name: "checkpoint_status",
          description: "Show current checkpoint system status and information",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "view_debug_log",
          description: "View recent debug log entries for troubleshooting file counting issues",
          inputSchema: {
            type: "object",
            properties: {
              lines: {
                type: "number",
                description: "Number of lines to show from the end of the log (default: 50)"
              },
            },
          },
        },
        {
          name: "clear_debug_log",
          description: "Clear the debug log file",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error(`No arguments provided for tool: ${name}`);
    }

    try {
      switch (name) {
        case "create_checkpoint": {
          const validatedArgs = CreateCheckpointSchema.parse(args);
          const result = await createCheckpoint(validatedArgs);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        }

        case "show_timeline": {
          const validatedArgs = ShowTimelineSchema.parse(args);
          const result = await showTimeline(validatedArgs);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        }

        case "rollback_checkpoint": {
          const validatedArgs = RollbackCheckpointSchema.parse(args);
          const result = await rollbackCheckpoint(validatedArgs);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        }

        case "show_diff": {
          const validatedArgs = ShowDiffSchema.parse(args);
          const result = await showDiff(validatedArgs);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        }

        case "checkpoint_status": {
          const validatedArgs = CheckpointStatusSchema.parse(args);
          const result = await checkpointStatus(validatedArgs);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        }

        case "view_debug_log": {
          const validatedArgs = ViewDebugLogSchema.parse(args);
          const result = await viewDebugLog(validatedArgs);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        }

        case "clear_debug_log": {
          const validatedArgs = ClearDebugLogSchema.parse(args);
          const result = await clearDebugLog();
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      // Log the error for debugging
      console.error(`Error in tool ${name}:`, error);
      
      // Return error information to the client
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            tool: name
          }, null, 2)
        }]
      };
    }
  });

  return server;
}