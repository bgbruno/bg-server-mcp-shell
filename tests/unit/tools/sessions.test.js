import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

/**
 * Unit tests for session management tools:
 * - listSessions
 * - getSessionOutput
 * - cleanupSessions
 * 
 * These tests verify:
 * - Session listing and tracking
 * - Output buffering and retrieval
 * - Session cleanup
 * - Session state management
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

describe('listSessions', () => {
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
  
  it('should return empty array when no sessions exist', async () => {
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'listSessions',
        arguments: {}
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    assert.strictEqual(response.result.structuredContent.ok, true);
    assert.strictEqual(Array.isArray(response.result.structuredContent.sessions), true);
    assert.strictEqual(response.result.structuredContent.sessions.length, 0);
  });
  
  it('should list active sessions', async () => {
    // Start a background process
    const startId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: startId,
      method: 'tools/call',
      params: {
        name: 'startProcessBackground',
        arguments: {
          cmd: 'sleep',
          args: ['3']
        }
      }
    });
    
    const startResponse = await testServer.waitForResponse(startId);
    const sessionId = startResponse.result.structuredContent.sessionId;
    
    // List sessions
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
    
    assert.strictEqual(listResponse.result.structuredContent.sessions.length, 1);
    
    const session = listResponse.result.structuredContent.sessions[0];
    assert.strictEqual(session.sessionId, sessionId);
    assert.strictEqual(session.cmd, 'sleep');
    assert.deepStrictEqual(session.args, ['3']);
    assert.ok(session.pid > 0);
    assert.ok(session.startedAt);
  });
  
  it('should show session status correctly', async () => {
    // Start a quick process with explicit sleep to ensure completion
    const startId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: startId,
      method: 'tools/call',
      params: {
        name: 'startProcessBackground',
        arguments: {
          cmd: 'bash',
          args: ['-c', 'echo test; exit 0']
        }
      }
    });
    
    await testServer.waitForResponse(startId);
    
    // Wait longer for process to finish
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // List sessions
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
    
    const response = await testServer.waitForResponse(listId);
    const sessions = response.result.structuredContent.sessions;
    
    // Find our session (might be multiple from previous tests)
    assert.ok(sessions.length > 0);
    const session = sessions[sessions.length - 1]; // Get latest
    
    // Process should be finished by now
    assert.strictEqual(session.isRunning, false);
    assert.strictEqual(typeof session.exitCode, 'number');
  });
  
  it('should track output line count', async () => {
    // Start process with output
    const startId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: startId,
      method: 'tools/call',
      params: {
        name: 'startProcessBackground',
        arguments: {
          cmd: 'bash',
          args: ['-c', 'echo line1; echo line2; echo line3; exit 0']
        }
      }
    });
    
    const startResponse = await testServer.waitForResponse(startId);
    const sessionId = startResponse.result.structuredContent.sessionId;
    
    // Wait for output to be captured
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // List sessions
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
    
    const response = await testServer.waitForResponse(listId);
    const session = response.result.structuredContent.sessions.find(s => s.sessionId === sessionId);
    
    assert.ok(session, 'Session should exist');
    assert.ok(session.outputLines >= 1, `Expected outputLines > 0, got ${session.outputLines}`);
  });
});

describe('getSessionOutput', () => {
  let testServer;
  let sessionId;
  
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
    
    // Start a test process
    const startId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: startId,
      method: 'tools/call',
      params: {
        name: 'startProcessBackground',
        arguments: {
          cmd: 'bash',
          args: ['-c', 'echo Hello; sleep 1; echo World']
        }
      }
    });
    
    const response = await testServer.waitForResponse(startId);
    sessionId = response.result.structuredContent.sessionId;
  });
  
  after(() => {
    testServer.close();
  });
  
  it('should return error for non-existent session', async () => {
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'getSessionOutput',
        arguments: {
          sessionId: 'non-existent-id'
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    assert.strictEqual(response.result.structuredContent.ok, false);
    assert.match(response.result.structuredContent.error, /not found/i);
  });
  
  it('should retrieve session output', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'getSessionOutput',
        arguments: {
          sessionId
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    assert.strictEqual(response.result.structuredContent.ok, true);
    assert.strictEqual(response.result.structuredContent.sessionId, sessionId);
    assert.ok(Array.isArray(response.result.structuredContent.output));
    assert.ok(response.result.structuredContent.output.length > 0);
  });
  
  it('should support fromIndex parameter', async () => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Get all output first
    const firstId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: firstId,
      method: 'tools/call',
      params: {
        name: 'getSessionOutput',
        arguments: { sessionId }
      }
    });
    
    const firstResponse = await testServer.waitForResponse(firstId);
    const totalLines = firstResponse.result.structuredContent.totalLines;
    
    // Get from index
    const secondId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: secondId,
      method: 'tools/call',
      params: {
        name: 'getSessionOutput',
        arguments: {
          sessionId,
          fromIndex: 1
        }
      }
    });
    
    const secondResponse = await testServer.waitForResponse(secondId);
    
    assert.ok(secondResponse.result.structuredContent.output.length < totalLines);
  });
  
  it('should include exit information for completed sessions', async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'getSessionOutput',
        arguments: { sessionId }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    assert.strictEqual(response.result.structuredContent.isRunning, false);
    assert.strictEqual(response.result.structuredContent.exitCode, 0);
  });
});

describe('cleanupSessions', () => {
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
  
  it('should return error when cleaning non-existent session', async () => {
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'cleanupSessions',
        arguments: {
          sessionId: 'non-existent'
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    assert.strictEqual(response.result.structuredContent.ok, false);
    assert.match(response.result.structuredContent.error, /not found/i);
  });
  
  it('should not cleanup running session', async () => {
    // Start long-running process
    const startId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: startId,
      method: 'tools/call',
      params: {
        name: 'startProcessBackground',
        arguments: {
          cmd: 'sleep',
          args: ['5']
        }
      }
    });
    
    const startResponse = await testServer.waitForResponse(startId);
    const sessionId = startResponse.result.structuredContent.sessionId;
    
    // Try to cleanup
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
    
    const response = await testServer.waitForResponse(cleanupId);
    
    assert.strictEqual(response.result.structuredContent.ok, false);
    assert.match(response.result.structuredContent.error, /still running/i);
  });
  
  it('should cleanup finished session', async () => {
    // Start quick process
    const startId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: startId,
      method: 'tools/call',
      params: {
        name: 'startProcessBackground',
        arguments: {
          cmd: 'echo',
          args: ['cleanup test']
        }
      }
    });
    
    const startResponse = await testServer.waitForResponse(startId);
    const sessionId = startResponse.result.structuredContent.sessionId;
    
    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Cleanup
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
    
    assert.strictEqual(cleanupResponse.result.structuredContent.ok, true);
    assert.strictEqual(cleanupResponse.result.structuredContent.cleaned, 1);
    
    // Verify session is gone
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
    const session = listResponse.result.structuredContent.sessions.find(s => s.sessionId === sessionId);
    
    assert.strictEqual(session, undefined);
  });
  
  it('should cleanup all finished sessions when no sessionId provided', async () => {
    // Start multiple quick processes
    for (let i = 0; i < 3; i++) {
      const id = randomUUID();
      testServer.send({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: {
          name: 'startProcessBackground',
          arguments: {
            cmd: 'echo',
            args: [`test ${i}`]
          }
        }
      });
      await testServer.waitForResponse(id);
    }
    
    // Wait for all to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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
    
    const response = await testServer.waitForResponse(cleanupId);
    
    assert.strictEqual(response.result.structuredContent.ok, true);
    assert.ok(response.result.structuredContent.cleaned >= 3);
  });
});
