# MCP Checkpoint Server

An MCP (Model Context Protocol) server that provides "time travel" functionality for AI agent sessions. Create checkpoints during conversations and rollback to previous states when needed.

## Features

- **Create Checkpoints**: Snapshot your workspace state at any point
- **Timeline View**: See chronological history of all checkpoints
- **Rollback**: Restore workspace to any previous checkpoint
- **Diff Viewer**: Compare changes between checkpoints
- **Status Monitoring**: Track checkpoint system status

## Quick Start

### Installation

#### NPX (Recommended)
```bash
npx -y @modelcontextprotocol/server-checkpoint
```

#### Docker
```bash
docker run -i -v /path/to/workspace:/workspace -v checkpoint-storage:/app/checkpoints mcp/checkpoint
```

### Configuration

#### Claude Desktop
Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "checkpoint": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-checkpoint"],
      "env": {
        "CHECKPOINT_WORKSPACE_PATH": "/path/to/your/workspace",
        "CHECKPOINT_STORAGE_PATH": "/path/to/checkpoint/storage"
      }
    }
  }
}
```

#### VS Code
Add to your VS Code settings or `.vscode/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "checkpoint": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-checkpoint"],
        "env": {
          "CHECKPOINT_WORKSPACE_PATH": "/path/to/your/workspace",
          "CHECKPOINT_STORAGE_PATH": "/path/to/checkpoint/storage"
        }
      }
    }
  }
}
```

## Environment Variables

- `CHECKPOINT_WORKSPACE_PATH`: Path to the workspace to track (default: current directory)
- `CHECKPOINT_STORAGE_PATH`: Path to store checkpoint data (default: `~/.mcp-checkpoint`)
- `CHECKPOINT_EXCLUSIONS_FILE`: Path to custom exclusions file (optional)

## Available Tools

### `create_checkpoint`
Create a new checkpoint of the current workspace state.

**Parameters:**
- `message` (optional): Description for the checkpoint

**Example:**
```json
{
  "message": "Added user authentication system"
}
```

### `show_timeline`
Display chronological timeline of all checkpoints.

**Parameters:**
- `limit` (optional): Maximum number of checkpoints to show (default: 20)

### `rollback_checkpoint`
Rollback workspace to a previous checkpoint state.

**Parameters:**
- `checkpointId` (required): ID of the checkpoint to restore

### `show_diff`
Show differences between checkpoints or between a checkpoint and current state.

**Parameters:**
- `fromCheckpoint` (required): ID of the checkpoint to compare from
- `toCheckpoint` (optional): ID of the checkpoint to compare to (defaults to current state)

### `checkpoint_status`
Show current checkpoint system status and information.

**Parameters:** None

## How It Works

The checkpoint system uses a "shadow Git repository" approach:

1. **Shadow Repository**: Creates an isolated Git repository that tracks file changes without interfering with your main Git workflow
2. **File Exclusions**: Automatically excludes build artifacts, node_modules, media files, and other unnecessary files
3. **Metadata Storage**: Maintains checkpoint metadata (descriptions, timestamps, file counts) separately from Git
4. **Workspace Isolation**: Each workspace gets its own checkpoint history based on path hash

## File Exclusions

By default, the following are excluded from checkpoints:
- Build artifacts (`node_modules/`, `dist/`, `build/`, etc.)
- Media files (images, videos, audio)
- Cache and temporary files
- Environment configuration files
- Database files
- Large binary files

## Safety Features

- Prevents usage in protected directories (home, Desktop, Documents, Downloads)
- Validates workspace permissions before operations
- Handles nested Git repositories safely
- Comprehensive error handling and recovery

## Development

### Building
```bash
npm run build
```

### Watching
```bash
npm run watch
```

### Docker Build
```bash
docker build -t mcp/checkpoint .
```

## Architecture

- **CheckpointTracker**: Core checkpoint management
- **GitOperations**: Git-specific operations for shadow repositories
- **CheckpointMetadata**: Metadata storage and retrieval
- **Tools**: Individual MCP tool implementations
- **Config**: Environment configuration and validation

## Troubleshooting

### Git Not Found
Ensure Git is installed and available in your PATH:
```bash
git --version
```

### Permission Errors
Make sure the workspace and storage directories have appropriate read/write permissions.

### Large Repository Performance
The system automatically excludes large files and binary content. For very large repositories, consider adding custom exclusion patterns.

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions welcome! Please see CONTRIBUTING.md for guidelines.

## Support

- **Issues**: [GitHub Issues](https://github.com/modelcontextprotocol/servers/issues)
- **Documentation**: [MCP Documentation](https://modelcontextprotocol.io)
- **Community**: [MCP Discord](https://discord.gg/modelcontextprotocol)