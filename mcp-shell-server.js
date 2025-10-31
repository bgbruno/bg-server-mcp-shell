#!/usr/bin/env node
import os from "os";
import pty from "node-pty";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const sessions = new Map();

const server = new McpServer({
  name: "bg-server-mcp-shell",
  version: "1.0.0"
});

// Tool: Start a long-running process in a PTY
server.registerTool(
  "startProcess",
  {
    title: "Start Process",
    description: "Start a long-running process in a PTY and stream output in real time.",
    inputSchema: {
      cmd: z.string(),
      args: z.array(z.string()).optional(),
      cwd: z.string().optional(),
      env: z.record(z.string()).optional(),
      cols: z.number().optional(),
      rows: z.number().optional(),
      shellOnWindows: z.boolean().optional()
    },
    outputSchema: {
      ok: z.boolean(),
      sessionId: z.string().optional(),
      pid: z.number().optional(),
      error: z.string().optional()
    }
  },
  async ({ cmd, args = [], cwd = process.cwd(), env = {}, cols = 120, rows = 30, shellOnWindows = false }) => {
    const isWin = os.platform() === "win32";
    const exe = isWin && shellOnWindows ? "powershell.exe" : cmd;
    const argv = isWin && shellOnWindows
      ? ["-NoLogo", "-Command", `${cmd} ${args.join(" ")}`]
      : args;

    const p = pty.spawn(exe, argv, {
      name: "xterm-color",
      cols,
      rows,
      cwd,
      env: { ...process.env, ...env }
    });

    const sessionId = randomUUID();
    const outputBuffer = [];
    const maxBufferSize = 10000; // Max lines to keep
    
    sessions.set(sessionId, {
      pid: p.pid,
      pty: p,
      cwd,
      cmd: exe,
      args: argv,
      cols,
      rows,
      startedAt: new Date().toISOString(),
      output: outputBuffer,
      exitCode: null,
      exitSignal: null,
      isRunning: true
    });

    p.onData((data) => {
      // Buffer output for reading
      outputBuffer.push({ type: 'stdout', data, timestamp: new Date().toISOString() });
      if (outputBuffer.length > maxBufferSize) {
        outputBuffer.shift(); // Remove oldest
      }
      console.error(`[${sessionId}] ${data}`);
    });

    p.onExit(({ exitCode, signal }) => {
      const session = sessions.get(sessionId);
      if (session) {
        session.isRunning = false;
        session.exitCode = exitCode;
        session.exitSignal = signal;
        session.output.push({ 
          type: 'exit', 
          exitCode, 
          signal, 
          timestamp: new Date().toISOString() 
        });
      }
      console.error(`[${sessionId}] Process exited: code=${exitCode}, signal=${signal}`);
    });

    const output = {
      ok: true,
      sessionId,
      pid: p.pid
    };

    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output
    };
  }
);

// Tool: Write input to PTY session
server.registerTool(
  "writeInput",
  {
    title: "Write Input",
    description: "Write input to a running PTY session",
    inputSchema: {
      sessionId: z.string(),
      data: z.string()
    },
    outputSchema: {
      ok: z.boolean(),
      error: z.string().optional()
    }
  },
  async ({ sessionId, data }) => {
    const s = sessions.get(sessionId);
    if (!s) {
      const output = { ok: false, error: "Session not found" };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output
      };
    }
    s.pty.write(data);
    const output = { ok: true };
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output
    };
  }
);

// Tool: Get session output
server.registerTool(
  "getSessionOutput",
  {
    title: "Get Session Output",
    description: "Get the buffered output from a running or completed PTY session",
    inputSchema: {
      sessionId: z.string(),
      fromIndex: z.number().optional()
    },
    outputSchema: {
      ok: z.boolean(),
      sessionId: z.string().optional(),
      isRunning: z.boolean().optional(),
      exitCode: z.number().nullable().optional(),
      exitSignal: z.number().nullable().optional(),
      output: z.array(z.any()).optional(),
      totalLines: z.number().optional(),
      error: z.string().optional()
    }
  },
  async ({ sessionId, fromIndex = 0 }) => {
    const s = sessions.get(sessionId);
    if (!s) {
      const output = { ok: false, error: "Session not found" };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output
      };
    }
    
    const outputSlice = s.output.slice(fromIndex);
    const output = {
      ok: true,
      sessionId,
      isRunning: s.isRunning,
      exitCode: s.exitCode,
      exitSignal: s.exitSignal,
      output: outputSlice,
      totalLines: s.output.length
    };
    
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output
    };
  }
);

// Tool: List all sessions
server.registerTool(
  "listSessions",
  {
    title: "List Sessions",
    description: "List all active PTY sessions",
    inputSchema: {},
    outputSchema: {
      ok: z.boolean(),
      sessions: z.array(z.any()).optional()
    }
  },
  async () => {
    const sessionList = Array.from(sessions.entries()).map(([id, s]) => ({
      sessionId: id,
      pid: s.pid,
      cmd: s.cmd,
      args: s.args,
      cwd: s.cwd,
      isRunning: s.isRunning,
      exitCode: s.exitCode,
      startedAt: s.startedAt,
      outputLines: s.output.length
    }));
    
    const output = {
      ok: true,
      sessions: sessionList
    };
    
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output
    };
  }
);

// Tool: Stop a PTY session
server.registerTool(
  "stopProcess",
  {
    title: "Stop Process",
    description: "Stop a running PTY session",
    inputSchema: {
      sessionId: z.string()
    },
    outputSchema: {
      ok: z.boolean(),
      killed: z.boolean().optional(),
      error: z.string().optional()
    }
  },
  async ({ sessionId }) => {
    const s = sessions.get(sessionId);
    if (!s) {
      const output = { ok: false, error: "Session not found" };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output
      };
    }
    try {
      s.pty.kill();
      s.isRunning = false;
      // Don't delete session immediately - keep it for output reading
      // Sessions will be cleaned up on server restart or manually
      const output = { ok: true, killed: true };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output
      };
    } catch (e) {
      const output = { ok: false, error: String(e) };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output
      };
    }
  }
);

// Tool: Clean up finished sessions
server.registerTool(
  "cleanupSessions",
  {
    title: "Cleanup Sessions",
    description: "Remove finished (non-running) sessions from memory",
    inputSchema: {
      sessionId: z.string().optional()
    },
    outputSchema: {
      ok: z.boolean(),
      cleaned: z.number().optional(),
      error: z.string().optional()
    }
  },
  async ({ sessionId }) => {
    if (sessionId) {
      // Clean specific session
      const s = sessions.get(sessionId);
      if (!s) {
        const output = { ok: false, error: "Session not found" };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output
        };
      }
      if (s.isRunning) {
        const output = { ok: false, error: "Session is still running" };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output
        };
      }
      sessions.delete(sessionId);
      const output = { ok: true, cleaned: 1 };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output
      };
    } else {
      // Clean all finished sessions
      let cleaned = 0;
      for (const [id, s] of sessions.entries()) {
        if (!s.isRunning) {
          sessions.delete(id);
          cleaned++;
        }
      }
      const output = { ok: true, cleaned };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output
      };
    }
  }
);

process.on("SIGINT", () => {
  for (const s of sessions.values()) {
    try { s.pty.kill(); } catch {}
  }
  process.exit(0);
});

const transport = new StdioServerTransport();
await server.connect(transport);
