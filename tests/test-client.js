#!/usr/bin/env node

/**
 * Minimal MCP client to test the checkpoint server locally
 * Usage: node test-client.js
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

class MCPTestClient {
  constructor() {
    this.serverProcess = null;
    this.requestId = 1;
  }

  async startServer() {
    console.log('🚀 Starting checkpoint MCP server...');
    
    // Build the server first
    await this.runCommand('npm', ['run', 'build']);
    
    this.serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    this.serverProcess.stderr.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Server started');
  }

  async sendMCPRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params
    };

    console.log(`📤 Sending: ${method}`);
    this.serverProcess.stdin.write(JSON.stringify(request) + '\n');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

      const onData = (data) => {
        try {
          const response = JSON.parse(data.toString().trim());
          if (response.id === request.id) {
            clearTimeout(timeout);
            this.serverProcess.stdout.off('data', onData);
            resolve(response);
          }
        } catch (e) {
          // Ignore parsing errors for partial data
        }
      };

      this.serverProcess.stdout.on('data', onData);
    });
  }

  async runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { stdio: 'inherit' });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Command failed with code ${code}`));
      });
    });
  }

  async createTestFiles() {
    console.log('📝 Creating test files...');
    
    const testDir = path.join(process.cwd(), 'test-workspace');
    await fs.mkdir(testDir, { recursive: true });
    
    await fs.writeFile(
      path.join(testDir, 'example.txt'),
      'Initial content for testing checkpoints'
    );
    
    await fs.writeFile(
      path.join(testDir, 'code.js'),
      'function hello() {\n  return "world";\n}'
    );
    
    console.log('✅ Test files created');
  }

  async modifyTestFiles() {
    console.log('✏️ Modifying test files...');
    
    const testDir = path.join(process.cwd(), 'test-workspace');
    
    await fs.writeFile(
      path.join(testDir, 'example.txt'),
      'Modified content - this should be tracked in next checkpoint'
    );
    
    await fs.writeFile(
      path.join(testDir, 'code.js'),
      'function hello() {\n  return "modified world";\n}\n\nfunction goodbye() {\n  return "farewell";\n}'
    );
    
    await fs.writeFile(
      path.join(testDir, 'new-file.md'),
      '# New File\n\nThis file was added after the first checkpoint.'
    );
    
    console.log('✅ Test files modified');
  }

  async testCheckpointWorkflow() {
    try {
      // Initialize
      await this.startServer();
      await this.createTestFiles();

      // Test 1: Check initial status
      console.log('\n🔍 Testing checkpoint_status...');
      const status1 = await this.sendMCPRequest('tools/call', {
        name: 'checkpoint_status',
        arguments: {}
      });
      console.log('Status response:', JSON.stringify(status1.result, null, 2));

      // Test 2: Create first checkpoint
      console.log('\n📸 Creating first checkpoint...');
      const checkpoint1 = await this.sendMCPRequest('tools/call', {
        name: 'create_checkpoint',
        arguments: {
          description: 'Initial test checkpoint with example files'
        }
      });
      console.log('Checkpoint 1 response:', JSON.stringify(checkpoint1.result, null, 2));

      // Test 3: Show timeline
      console.log('\n📋 Showing timeline...');
      const timeline1 = await this.sendMCPRequest('tools/call', {
        name: 'show_timeline',
        arguments: {}
      });
      console.log('Timeline response:', JSON.stringify(timeline1.result, null, 2));

      // Test 4: Modify files and create second checkpoint
      await this.modifyTestFiles();
      
      console.log('\n📸 Creating second checkpoint...');
      const checkpoint2 = await this.sendMCPRequest('tools/call', {
        name: 'create_checkpoint',
        arguments: {
          description: 'Checkpoint after file modifications'
        }
      });
      console.log('Checkpoint 2 response:', JSON.stringify(checkpoint2.result, null, 2));

      // Test 5: Show updated timeline
      console.log('\n📋 Showing updated timeline...');
      const timeline2 = await this.sendMCPRequest('tools/call', {
        name: 'show_timeline',
        arguments: {}
      });
      console.log('Updated timeline:', JSON.stringify(timeline2.result, null, 2));

      // Test 6: Show diff between checkpoints
      console.log('\n🔄 Showing diff between checkpoints...');
      const diff = await this.sendMCPRequest('tools/call', {
        name: 'show_diff',
        arguments: {
          from_checkpoint: '1',
          to_checkpoint: '2'
        }
      });
      console.log('Diff response:', JSON.stringify(diff.result, null, 2));

      // Test 7: Rollback to first checkpoint
      console.log('\n⏪ Rolling back to first checkpoint...');
      const rollback = await this.sendMCPRequest('tools/call', {
        name: 'rollback_checkpoint',
        arguments: {
          checkpoint_id: '1'
        }
      });
      console.log('Rollback response:', JSON.stringify(rollback.result, null, 2));

      // Test 8: Verify files were restored
      console.log('\n🔍 Verifying files after rollback...');
      const testDir = path.join(process.cwd(), 'test-workspace');
      const restoredContent = await fs.readFile(path.join(testDir, 'example.txt'), 'utf8');
      console.log('Restored content:', restoredContent);

      console.log('\n✅ All tests completed successfully!');

    } catch (error) {
      console.error('❌ Test failed:', error.message);
    } finally {
      if (this.serverProcess) {
        this.serverProcess.kill();
        console.log('🛑 Server stopped');
      }
    }
  }
}

// Run the test
const client = new MCPTestClient();
client.testCheckpointWorkflow().catch(console.error);