#!/usr/bin/env node
import { spawn } from 'child_process';

// Spawn the MCP server
const server = spawn('node', ['bg-server-mcp-shell.js'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'inherit']
});

let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // Try to parse complete JSON-RPC messages
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('📨 Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('📝 Output:', line);
      }
    }
  }
});

server.on('error', (err) => {
  console.error('❌ Error:', err);
});

server.on('close', (code) => {
  console.log(`🔚 Server exited with code ${code}`);
  process.exit(code);
});

// Wait a bit for server to start
await new Promise(resolve => setTimeout(resolve, 500));

// Send initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {
      roots: { listChanged: true },
      sampling: {}
    },
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

console.log('📤 Sending initialize request...');
server.stdin.write(JSON.stringify(initRequest) + '\n');

// Wait for response
await new Promise(resolve => setTimeout(resolve, 1000));

// List tools request
const listToolsRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list',
  params: {}
};

console.log('📤 Sending tools/list request...');
server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

// Wait for response
await new Promise(resolve => setTimeout(resolve, 1000));

// Call startProcess tool to run 'echo Hello from MCP!'
const callToolRequest = {
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: {
    name: 'startProcess',
    arguments: {
      cmd: 'echo',
      args: ['Hello from MCP Shell Server! 🚀'],
      cwd: process.cwd()
    }
  }
};

console.log('\n📤 Calling startProcess tool (echo command)...');
server.stdin.write(JSON.stringify(callToolRequest) + '\n');

// Wait for response
await new Promise(resolve => setTimeout(resolve, 1500));

// Wait a bit for output to accumulate
await new Promise(resolve => setTimeout(resolve, 500));

// Get session output
const getOutputRequest = {
  jsonrpc: '2.0',
  id: 4,
  method: 'tools/call',
  params: {
    name: 'getSessionOutput',
    arguments: {
      sessionId: null // Will be filled from previous response
    }
  }
};

// Extract sessionId from previous response
let sessionId;
await new Promise(resolve => setTimeout(resolve, 100));

// List sessions
const listSessionsRequest = {
  jsonrpc: '2.0',
  id: 5,
  method: 'tools/call',
  params: {
    name: 'listSessions',
    arguments: {}
  }
};

console.log('\n📤 Calling listSessions tool...');
server.stdin.write(JSON.stringify(listSessionsRequest) + '\n');

// Wait for response
await new Promise(resolve => setTimeout(resolve, 1000));

// Cleanup
console.log('\n✅ Test completed, shutting down...');
server.kill('SIGTERM');

await new Promise(resolve => setTimeout(resolve, 500));
process.exit(0);
