import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

/**
 * Unit tests for startProcessAndWait and startProcessBackground
 * 
 * These tests verify:
 * - Command execution with proper arguments
 * - Timeout handling
 * - Exit code capture
 * - Output buffering
 * - Session creation and tracking
 */

// Helper to create a test MCP server instance
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

describe('startProcessAndWait', () => {
  let testServer;
  
  before(async () => {
    testServer = createTestServer();
    
    // Initialize server
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
  
  it('should execute simple command and return output', async () => {
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'startProcessAndWait',
        arguments: {
          cmd: 'echo',
          args: ['Hello Test']
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    assert.strictEqual(response.error, undefined);
    assert.strictEqual(response.result.structuredContent.ok, true);
    assert.strictEqual(response.result.structuredContent.exitCode, 0);
    
    const stdout = response.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    
    assert.match(stdout, /Hello Test/);
  });
  
  it('should handle command with non-zero exit code', async () => {
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'startProcessAndWait',
        arguments: {
          cmd: 'bash',
          args: ['-c', 'exit 42']
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    assert.strictEqual(response.result.structuredContent.exitCode, 42);
  });
  
  it('should timeout long-running commands', async () => {
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'startProcessAndWait',
        arguments: {
          cmd: 'sleep',
          args: ['10'],
          timeoutMs: 1000
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    assert.strictEqual(response.result.structuredContent.ok, false);
    assert.match(response.result.structuredContent.error, /timeout/i);
  });
  
  it('should respect custom working directory', async () => {
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'startProcessAndWait',
        arguments: {
          cmd: 'pwd',
          args: [],
          cwd: '/tmp'
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    const stdout = response.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    
    assert.match(stdout, /\/tmp/);
  });
  
  it('should pass environment variables', async () => {
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'startProcessAndWait',
        arguments: {
          cmd: 'bash',
          args: ['-c', 'echo $TEST_VAR'],
          env: { TEST_VAR: 'test-value-123' }
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    const stdout = response.result.structuredContent.output
      .filter(o => o.type === 'stdout')
      .map(o => o.data)
      .join('');
    
    assert.match(stdout, /test-value-123/);
  });
});

describe('startProcessBackground', () => {
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
  
  it('should start process in background and return sessionId', async () => {
    const requestId = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'startProcessBackground',
        arguments: {
          cmd: 'sleep',
          args: ['2']
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    
    assert.strictEqual(response.result.structuredContent.ok, true);
    assert.ok(response.result.structuredContent.sessionId);
    assert.ok(response.result.structuredContent.pid > 0);
  });
  
  it('should start process without blocking', async () => {
    const requestId = randomUUID();
    const startTime = Date.now();
    
    testServer.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'startProcessBackground',
        arguments: {
          cmd: 'sleep',
          args: ['5']
        }
      }
    });
    
    const response = await testServer.waitForResponse(requestId);
    const duration = Date.now() - startTime;
    
    // Should return immediately, not wait for 5 seconds
    assert.ok(duration < 2000, `Should return quickly, but took ${duration}ms`);
    assert.strictEqual(response.result.structuredContent.ok, true);
  });
});
