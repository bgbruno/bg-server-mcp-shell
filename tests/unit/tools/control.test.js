import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

/**
 * Unit tests for process control tools:
 * - writeInput
 * - stopProcess
 * 
 * These tests verify:
 * - Sending input to running processes
 * - Graceful process termination
 * - Error handling for invalid sessions
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

describe('writeInput', () => {
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
  
  it('should return error for non-existent session', async () => {
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'writeInput',
        arguments: {
          sessionId: 'non-existent',
          data: 'test'
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    assert.strictEqual(response.result.structuredContent.ok, false);
    assert.match(response.result.structuredContent.error, /not found/i);
  });
  
  it('should send input to running process', async () => {
    // Start interactive process (cat)
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
    
    // Write input
    const writeId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: writeId,
      method: 'tools/call',
      params: {
        name: 'writeInput',
        arguments: {
          sessionId,
          data: 'Hello from test\n'
        }
      }
    });
    
    const writeResponse = await testServer.waitForResponse(writeId);
    
    assert.strictEqual(writeResponse.result.structuredContent.ok, true);
    
    // Wait for echo
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get output
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
    const stdout = outputResponse.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    
    assert.match(stdout, /Hello from test/);
    
    // Cleanup
    testServer.send({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'tools/call',
      params: {
        name: 'stopProcess',
        arguments: { sessionId }
      }
    });
  });
  
  it('should handle multiple sequential writes', async () => {
    // Start cat process
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
    
    // Write multiple lines
    for (let i = 1; i <= 3; i++) {
      const writeId = randomUUID();
      testServer.send({
        jsonrpc: '2.0',
        id: writeId,
        method: 'tools/call',
        params: {
          name: 'writeInput',
          arguments: {
            sessionId,
            data: `Line ${i}\n`
          }
        }
      });
      await testServer.waitForResponse(writeId);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Get output
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
    const stdout = outputResponse.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    
    assert.match(stdout, /Line 1/);
    assert.match(stdout, /Line 2/);
    assert.match(stdout, /Line 3/);
    
    // Cleanup
    testServer.send({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'tools/call',
      params: {
        name: 'stopProcess',
        arguments: { sessionId }
      }
    });
  });
  
  it('should handle special characters and unicode', async () => {
    // Start cat process
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
    
    // Write unicode and special chars
    const writeId = randomUUID();
    testServer.send({
      jsonrpc: '2.0',
      id: writeId,
      method: 'tools/call',
      params: {
        name: 'writeInput',
        arguments: {
          sessionId,
          data: 'Ahoj 🚀 Slovensko! $PATH & "test"\n'
        }
      }
    });
    
    await testServer.waitForResponse(writeId);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get output
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
    const stdout = outputResponse.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    
    assert.match(stdout, /Ahoj.*Slovensko/);
    
    // Cleanup
    testServer.send({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'tools/call',
      params: {
        name: 'stopProcess',
        arguments: { sessionId }
      }
    });
  });
});

describe('stopProcess', () => {
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
  
  it('should return error for non-existent session', async () => {
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'stopProcess',
        arguments: {
          sessionId: 'non-existent'
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    assert.strictEqual(response.result.structuredContent.ok, false);
    assert.match(response.result.structuredContent.error, /not found/i);
  });
  
  it('should stop running process', async () => {
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
          args: ['10']
        }
      }
    });
    
    const startResponse = await testServer.waitForResponse(startId);
    const sessionId = startResponse.result.structuredContent.sessionId;
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Stop process
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
    
    const stopResponse = await testServer.waitForResponse(stopId);
    
    assert.strictEqual(stopResponse.result.structuredContent.ok, true);
    assert.strictEqual(stopResponse.result.structuredContent.killed, true);
    
    // Verify session is stopped
    await new Promise(resolve => setTimeout(resolve, 200));
    
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
    
    assert.strictEqual(session.isRunning, false);
  });
  
  it('should be able to stop already finished process', async () => {
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
          args: ['test']
        }
      }
    });
    
    const startResponse = await testServer.waitForResponse(startId);
    const sessionId = startResponse.result.structuredContent.sessionId;
    
    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Try to stop (should succeed even though already finished)
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
    
    const stopResponse = await testServer.waitForResponse(stopId);
    
    assert.strictEqual(stopResponse.result.structuredContent.ok, true);
  });
  
  it('should preserve session data after stopping', async () => {
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
          args: ['-c', 'echo Before stop; sleep 10']
        }
      }
    });
    
    const startResponse = await testServer.waitForResponse(startId);
    const sessionId = startResponse.result.structuredContent.sessionId;
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Stop process
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
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get output (should still be accessible)
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
    
    assert.strictEqual(outputResponse.result.structuredContent.ok, true);
    
    const stdout = outputResponse.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    
    assert.match(stdout, /Before stop/);
  });
});
