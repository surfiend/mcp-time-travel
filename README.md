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

#### NPM (Recommended)
```bash
npx mcp-time-travel
```

#### Manual Installation
```bash
# Clone and build
git clone https://github.com/surfiend/mcp-time-travel.git
cd mcp-time-travel
npm install
npm run build
```

### Configuration

#### Claude Desktop
Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "time-travel": {
      "command": "npx",
      "args": ["-y", "mcp-time-travel"],
      "env": {
        "CHECKPOINT_WORKSPACE_PATH": "/path/to/your/workspace",
        "CHECKPOINT_STORAGE_PATH": "/path/to/checkpoint/storage"
      }
    }
  }
}
```

#### Other MCP Clients
For other MCP-compatible clients, use:

```bash
node /path/to/mcp-time-travel/dist/index.js
```

## Environment Variables

- `CHECKPOINT_WORKSPACE_PATH`: Path to the workspace to track (default: current directory)
- `CHECKPOINT_STORAGE_PATH`: Path to store checkpoint data (default: `~/.mcp-checkpoint`)

## Available Tools

### `create_checkpoint`
Create a new checkpoint of the current workspace state.

**Parameters:**
- `description` (optional): Description for the checkpoint

**Example:**
```json
{
  "description": "Added user authentication system"
}
```

### `show_timeline` 
Display chronological timeline of all checkpoints.

**Parameters:**
- `limit` (optional): Maximum number of checkpoints to show (default: 20)

### `rollback_checkpoint`
Rollback workspace to a previous checkpoint state.

**Parameters:**
- `checkpoint_id` (required): ID or number of the checkpoint to restore

### `show_diff`
Show differences between checkpoints or between a checkpoint and current state.

**Parameters:**
- `from_checkpoint` (required): ID of the checkpoint to compare from
- `to_checkpoint` (optional): ID of the checkpoint to compare to (defaults to current state)

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
- Large binary files (configurable via Git LFS patterns)

## Safety Features

- Prevents usage in protected directories (home, Desktop, Documents, Downloads)
- Validates workspace permissions before operations
- Handles nested Git repositories safely
- Comprehensive error handling and recovery
- Never interferes with existing Git workflows

## Testing

### Basic Test
```bash
# Run the automated test suite
./tests/test-simple.sh
```

### Manual Testing
```bash
# Build first
npm run build

# Test status
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"checkpoint_status","arguments":{}}}' | node dist/index.js

# Test checkpoint creation
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_checkpoint","arguments":{"description":"Test checkpoint"}}}' | node dist/index.js
```

### Advanced Testing
```bash
# Run the full interactive test suite
node tests/test-client.js
```

## Development

### Building
```bash
npm run build
```

### Watching for Changes
```bash
npm run watch
```

### Docker
```bash
docker build -t mcp/checkpoint .
```

## Architecture

- **CheckpointTracker**: Core checkpoint management and Git operations
- **GitOperations**: Low-level Git operations for shadow repositories  
- **CheckpointMetadata**: Metadata storage and retrieval
- **Tools**: Individual MCP tool implementations (`create_checkpoint`, `show_timeline`, etc.)
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
The system automatically excludes large files and binary content. For very large repositories, consider custom exclusion patterns via Git LFS configuration.

### Nested Git Repositories
The system safely handles nested Git repositories by temporarily disabling them during checkpoint operations, then re-enabling them afterward.

## Requirements

- Node.js 18+ 
- Git 2.0+
- Read/write access to workspace and storage directories

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Support

- **Issues**: [GitHub Issues](https://github.com/surfiend/mcp-time-travel/issues)
- **Documentation**: [MCP Documentation](https://modelcontextprotocol.io)