import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

/**
 * Integration tests for MCP Shell Server
 * 
 * These tests verify:
 * - Full MCP protocol communication
 * - End-to-end workflows
 * - Multiple tools working together
 * - Real-world usage scenarios
 */

// Helper to create test MCP server
function createTestServer() {
  const server = spawn('node', ['bg-server-mcp-shell.js'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let responseBuffer = '';
  const responses = [];
  
  server.stdout.on('data', (data) => {
    responseBuffer += data.toString();
    const lines = responseBuffer.split('\n');
    responseBuffer = lines.pop();
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          responses.push(JSON.parse(line));
        } catch (e) {
          // Skip non-JSON lines
        }
      }
    }
  });
  
  return {
    server,
    responses,
    send: (request) => {
      server.stdin.write(JSON.stringify(request) + '\n');
    },
    waitForResponse: (id, timeoutMs = 5000) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for response with id ${id}`));
        }, timeoutMs);
        
        const check = () => {
          const response = responses.find(r => r.id === id);
          if (response) {
            clearTimeout(timeout);
            resolve(response);
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    },
    close: () => {
      server.kill();
    }
  };
}

describe('MCP Server - Initialization', () => {
  let testServer;
  
  before(() => {
    testServer = createTestServer();
  });
  
  after(() => {
    testServer.close();
  });
  
  it('should initialize with correct protocol version', async () => {
    testServer.send({
      jsonrpc: '2.0',
      id: 'init',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    });
    
    const response = await testServer.waitForResponse('init');
    
    assert.strictEqual(response.error, undefined);
    assert.ok(response.result);
    assert.strictEqual(response.result.serverInfo.name, 'bg-server-mcp-shell');
  });
  
  it('should list all available tools', async () => {
    testServer.send({
      jsonrpc: '2.0',
      id: 'list-tools',
      method: 'tools/list',
      params: {}
    });
    
    const response = await testServer.waitForResponse('list-tools');
    
    assert.ok(Array.isArray(response.result.tools));
    assert.ok(response.result.tools.length >= 6);
    
    const toolNames = response.result.tools.map(t => t.name);
    assert.ok(toolNames.includes('startProcessAndWait'));
    assert.ok(toolNames.includes('startProcessBackground'));
    assert.ok(toolNames.includes('listSessions'));
    assert.ok(toolNames.includes('getSessionOutput'));
    assert.ok(toolNames.includes('writeInput'));
    assert.ok(toolNames.includes('stopProcess'));
    assert.ok(toolNames.includes('cleanupSessions'));
  });
});

describe('MCP Server - Complete Workflow', () => {
  let testServer;
  
  before(async () => {
    testServer = createTestServer();
    
    testServer.send({
      jsonrpc: '2.0',
      id: 'init',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });
    
    await testServer.waitForResponse('init');
  });
  
  after(() => {
    testServer.close();
  });
  
  it('should execute complete session lifecycle', async () => {
    // 1. Start background process
    const startId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: startId,
      method: 'tools/call',
      params: {
        name: 'startProcessBackground',
        arguments: {
          cmd: 'bash',
          args: ['-c', 'echo "Starting..."; sleep 1; echo "Done!"']
        }
      }
    });
    
    const startResponse = await testServer.waitForResponse(startId);
    const sessionId = startResponse.result.structuredContent.sessionId;
    assert.ok(sessionId);
    
    // 2. List sessions (should show 1 running)
    const listId1 = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: listId1,
      method: 'tools/call',
      params: {
        name: 'listSessions',
        arguments: {}
      }
    });
    
    const listResponse1 = await testServer.waitForResponse(listId1);
    assert.strictEqual(listResponse1.result.structuredContent.sessions.length, 1);
    assert.strictEqual(listResponse1.result.structuredContent.sessions[0].sessionId, sessionId);
    
    // 3. Get output while running
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const outputId1 = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: outputId1,
      method: 'tools/call',
      params: {
        name: 'getSessionOutput',
        arguments: { sessionId }
      }
    });
    
    const outputResponse1 = await testServer.waitForResponse(outputId1);
    const output1 = outputResponse1.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    assert.match(output1, /Starting/);
    
    // 4. Wait for completion
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 5. Get final output
    const outputId2 = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: outputId2,
      method: 'tools/call',
      params: {
        name: 'getSessionOutput',
        arguments: { sessionId }
      }
    });
    
    const outputResponse2 = await testServer.waitForResponse(outputId2);
    const output2 = outputResponse2.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    assert.match(output2, /Done!/);
    assert.strictEqual(outputResponse2.result.structuredContent.isRunning, false);
    assert.strictEqual(outputResponse2.result.structuredContent.exitCode, 0);
    
    // 6. Cleanup session
    const cleanupId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: cleanupId,
      method: 'tools/call',
      params: {
        name: 'cleanupSessions',
        arguments: { sessionId }
      }
    });
    
    const cleanupResponse = await testServer.waitForResponse(cleanupId);
    assert.strictEqual(cleanupResponse.result.structuredContent.cleaned, 1);
    
    // 7. Verify session is gone
    const listId2 = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: listId2,
      method: 'tools/call',
      params: {
        name: 'listSessions',
        arguments: {}
      }
    });
    
    const listResponse2 = await testServer.waitForResponse(listId2);
    assert.strictEqual(listResponse2.result.structuredContent.sessions.length, 0);
  });
  
  it('should handle interactive process workflow', async () => {
    // 1. Start interactive cat process
    const startId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: startId,
      method: 'tools/call',
      params: {
        name: 'startProcessBackground',
        arguments: {
          cmd: 'cat',
          args: []
        }
      }
    });
    
    const startResponse = await testServer.waitForResponse(startId);
    const sessionId = startResponse.result.structuredContent.sessionId;
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 2. Write some input
    const writeId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: writeId,
      method: 'tools/call',
      params: {
        name: 'writeInput',
        arguments: {
          sessionId,
          data: 'Interactive test\n'
        }
      }
    });
    
    await testServer.waitForResponse(writeId);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 3. Get output
    const outputId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: outputId,
      method: 'tools/call',
      params: {
        name: 'getSessionOutput',
        arguments: { sessionId }
      }
    });
    
    const outputResponse = await testServer.waitForResponse(outputId);
    const output = outputResponse.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    assert.match(output, /Interactive test/);
    
    // 4. Stop process
    const stopId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: stopId,
      method: 'tools/call',
      params: {
        name: 'stopProcess',
        arguments: { sessionId }
      }
    });
    
    await testServer.waitForResponse(stopId);
    
    // 5. Cleanup
    const cleanupId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: cleanupId,
      method: 'tools/call',
      params: {
        name: 'cleanupSessions',
        arguments: {}
      }
    });
    
    await testServer.waitForResponse(cleanupId);
  });
  
  it('should handle multiple concurrent sessions', async () => {
    const sessionIds = [];
    
    // Start 3 concurrent processes
    for (let i = 1; i <= 3; i++) {
      const id = randomUUID();
      testServer.send({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: {
          name: 'startProcessBackground',
          arguments: {
            cmd: 'bash',
            args: ['-c', `echo "Process ${i}"; sleep 2`]
          }
        }
      });
      
      const response = await testServer.waitForResponse(id);
      sessionIds.push(response.result.structuredContent.sessionId);
    }
    
    // List all sessions
    const listId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: listId,
      method: 'tools/call',
      params: {
        name: 'listSessions',
        arguments: {}
      }
    });
    
    const listResponse = await testServer.waitForResponse(listId);
    assert.strictEqual(listResponse.result.structuredContent.sessions.length, 3);
    
    // Verify all session IDs are present
    const listedIds = listResponse.result.structuredContent.sessions.map(s => s.sessionId);
    for (const sid of sessionIds) {
      assert.ok(listedIds.includes(sid));
    }
    
    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Cleanup all
    const cleanupId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: cleanupId,
      method: 'tools/call',
      params: {
        name: 'cleanupSessions',
        arguments: {}
      }
    });
    
    const cleanupResponse = await testServer.waitForResponse(cleanupId);
    assert.ok(cleanupResponse.result.structuredContent.cleaned >= 3);
  });
});

describe('MCP Server - Real-world scenarios', () => {
  let testServer;
  
  before(async () => {
    testServer = createTestServer();
    
    testServer.send({
      jsonrpc: '2.0',
      id: 'init',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });
    
    await testServer.waitForResponse('init');
  });
  
  after(() => {
    testServer.close();
  });
  
  it('should execute git status command', async () => {
    const id = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'startProcessAndWait',
        arguments: {
          cmd: 'git',
          args: ['status', '--short'],
          cwd: process.cwd()
        }
      }
    });
    
    const response = await testServer.waitForResponse(id, 10000);
    
    assert.strictEqual(response.result.structuredContent.ok, true);
    // Git status should exit with 0 if successful
    assert.ok(response.result.structuredContent.exitCode === 0 || response.result.structuredContent.exitCode === 128);
  });
  
  it('should list directory contents', async () => {
    const id = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'startProcessAndWait',
        arguments: {
          cmd: 'ls',
          args: ['-la'],
          cwd: process.cwd()
        }
      }
    });
    
    const response = await testServer.waitForResponse(id);
    
    const output = response.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    
    assert.match(output, /package\.json/);
  });
  
  it('should execute npm commands', async () => {
    const id = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'startProcessAndWait',
        arguments: {
          cmd: 'npm',
          args: ['--version'],
          timeoutMs: 10000
        }
      }
    });
    
    const response = await testServer.waitForResponse(id, 15000);
    
    assert.strictEqual(response.result.structuredContent.ok, true);
    
    const output = response.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    
    // Should output npm version (e.g., "10.2.3")
    assert.match(output, /\d+\.\d+\.\d+/);
  });
});
