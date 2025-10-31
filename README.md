# 🐚 bg-mcp-shell-server

![Cover Image](cover-wide.jpg)

> MCP server for running long-running processes in PTY with real-time output streaming

---

## 💡 Use cases

**You:** "Run playwright tests and monitor for errors"

**AI:**
```
Running tests...

[chromium] › login.spec.ts:12:5 › user login
  ✓ should show login form (543ms)
  ✓ should validate email (234ms)
  
[chromium] › checkout.spec.ts:25:3 › payment flow
  ✗ should process payment (1823ms)
    Error: Timeout waiting for selector "button[data-testid=pay]"

❌ Found error in tests! 1 test failed.
```

**You:** "Build and deploy to Cloudflare"

**AI:**
```
Building project...
✓ 1245 modules transformed.
✓ built in 2.34s

Deploying to Cloudflare Pages...
✓ Uploading 143 files
✓ Deployment complete!

🚀 https://my-app-a1b2c3.pages.dev
✅ Successfully deployed to production
```

**You:** "Start docker-compose and tell me when postgres is ready"

**AI:**
```
Starting docker-compose...

postgres_1  | database system is ready to accept connections
redis_1     | Ready to accept connections  
web_1       | Server listening on port 3000

✅ Postgres is ready! All containers running.
```

---

## ✨ Features

- ✅ **Real-time output streaming** - Live terminal output
- ✅ **Interactive processes** - Send input to running processes
- ✅ **Multiple sessions** - Control multiple processes simultaneously
- ✅ **Buffered output** - Full output history preserved
- ✅ **PTY emulation** - True terminal experience

---

## 💡 Perfect For

- 🚀 **Dev servers** (Vite, webpack, Next.js)
- 🔄 **Watch modes** (nodemon, jest --watch)
- 🐳 **Docker/Docker Compose**
- 🧪 **Long-running tests**
- 💬 **Interactive CLI tools**

---

## 📊 Comparison

| Creator | Long-running processes | Output in response | Interaction | Best for |
|---------|----------------------|-------------------|------------|----------|
| **bg** | ✅ Yes | ✅ Buffer + terminal | ✅ writeInput | Dev servers, watch modes |
| **tumf** | ❌ Hangs | ✅ Yes | ✅ Yes | ls, cat, grep, git status |
| **hdresearch** | ❌ Hangs | ✅ Yes | ✅ Yes | Basic commands |
| **run_command** | ⚠️ Blocking/Async | ⚠️ Partial | ❌ No | Standard commands with user approval |

---

## 🚀 Quick Start

### Installation

```bash
npm install -g bg-server-mcp-shell
```

### Configuration

Add to your MCP client config (e.g., Claude Desktop, Cline):

```json
{
  "mcpServers": {
    "shell": {
      "command": "npx",
      "args": ["-y", "bg-server-mcp-shell@latest"],
      "env": {
        "COLOR": "false"
      }
    }
  }
}
```

---

## 🛠️ Available Tools

### CLI Usage (Advanced)

For testing or scripting, call tools directly via command line.

**Start the server:**
```bash
npx bg-server-mcp-shell
```

**Then in another terminal, send MCP requests:**

**Quick command (wait for completion):**
`startProcessAndWait` Run command and wait for completion
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"startProcessAndWait","arguments":{"cmd":"echo","args":["Hello"],"timeoutMs":5000}}}' | npx bg-server-mcp-shell
```

**Start a background process:**
`startProcessBackground` Start long-running process in background
```bash
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"startProcessBackground","arguments":{"cmd":"npm","args":["run","dev"]}}}' | npx bg-server-mcp-shell
```

**List sessions:**
`listSessions` List all active sessions
```bash
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"listSessions","arguments":{}}}' | npx bg-server-mcp-shell
```

**Get output:**
`getSessionOutput` Read buffered output from session
```bash
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"getSessionOutput","arguments":{"sessionId":"<id>"}}}' | npx bg-server-mcp-shell
```

**Send input:**
`writeInput` Send input to running process
```bash
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"writeInput","arguments":{"sessionId":"<id>","data":"rs\n"}}}' | npx bg-server-mcp-shell
```

**Stop process:**
`stopProcess` Stop a running session
```bash
echo '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"stopProcess","arguments":{"sessionId":"<id>"}}}' | npx bg-server-mcp-shell
```

**Cleanup finished sessions:**
`cleanupSessions` Remove finished sessions from memory
```bash
# Cleanup specific session
echo '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"cleanupSessions","arguments":{"sessionId":"<id>"}}}' | npx bg-server-mcp-shell

# Or cleanup all finished sessions
echo '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"cleanupSessions","arguments":{}}}' | npx bg-server-mcp-shell
```

---

## 🧪 Development & Testing

For developers contributing to this project:

```bash
# All tests
npm test

# Unit tests only (fast)
npm run test:unit

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch

# Verbose output
npm run test:verbose
```

**Full documentation:** See [Tests Documentation](tests/README.md) for complete testing guide, coverage, and API reference.

---

## 📦 Technical Details

- **Framework:** MCP (Model Context Protocol)
- **Test Runner:** Node.js native test runner (node:test)
- **PTY:** node-pty for terminal emulation
- **Node:** 18+ required
- **Platform:** macOS, Linux, Windows

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Ensure all tests pass: `npm test`
5. Submit a pull request

---

## 📄 License

MIT © [Bruno Garret](https://bgbruno.com)

---

## 🔗 Links

- [MCP Protocol Spec](https://modelcontextprotocol.io)
- [node-pty Documentation](https://github.com/microsoft/node-pty)
- [Node.js Test Runner](https://nodejs.org/api/test.html)
