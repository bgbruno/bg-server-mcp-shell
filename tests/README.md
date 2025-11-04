Documentations : [Main](../README.md) | [Tests](README.md)

# 🧪 Tests Documentation

## 🚀 Quick Start

```bash
# All tests (~7s)
npm test

# Fast unit tests (~1s, for development)
npm run test:unit

# Integration tests only (~6s)
npm run test:integration

# Watch mode (TDD)
npm run test:watch

# Verbose output (for debugging)
npm run test:verbose
```


## 📊 Test Commands

| Command | Tests | Time | Use Case |
|---------|-------|------|----------|
| `npm test` | All (20) | ~7s | Before commit, CI/CD |
| `npm run test:unit` | Unit (12) | ~1s | Feature development |
| `npm run test:integration` | Integration (8) | ~6s | End-to-end testing |
| `npm run test:watch` | All | ∞ | Active development (TDD) |
| `npm run test:verbose` | All | ~7s | Debugging failures |


## 🏗️ Test Structure

```
tests/
├── tests-run.sh                    # 🚀 Test runner helper
├── README.md                       # 📖 This documentation
├── unit/                           # Unit tests (~1s)
│   ├── spawn-helper.test.js        # PTY spawn function
│   └── tools/
│       ├── process.test.js         # startProcessAndWait, startProcessBackground
│       ├── sessions.test.js        # listSessions, getSessionOutput, cleanupSessions
│       └── control.test.js         # writeInput, stopProcess
└── integration/                    # Integration tests (~6s)
    └── mcp-server.test.js          # End-to-end MCP server tests
```

## 📊 Test Coverage

| MCP Function | Test File | Coverage |
|-------------|-----------|----------|
| `startProcessAndWait` | `unit/tools/process.test.js` | Execution, exit codes, timeouts |
| `startProcessBackground` | `unit/tools/process.test.js` | Non-blocking, session creation |
| `listSessions` | `unit/tools/sessions.test.js` | Empty list, active sessions, status |
| `getSessionOutput` | `unit/tools/sessions.test.js` | Output retrieval, fromIndex |
| `cleanupSessions` | `unit/tools/sessions.test.js` | Single/bulk cleanup |
| `writeInput` | `unit/tools/control.test.js` | Input handling, unicode |
| `stopProcess` | `unit/tools/control.test.js` | Termination, session preservation |
| `spawnPtyProcess` | `unit/spawn-helper.test.js` | PTY spawning, env vars, cross-platform |
| End-to-end | `integration/mcp-server.test.js` | MCP protocol, real workflows |

## 💡 Common Workflows

```bash
# Development workflow
npm run test:watch              # Auto-run tests on changes
npm run test:unit               # Fast feedback during coding
npm run test:verbose            # Debug failures

# Before commit
npm test                        # Run all tests

# Specific tests
npm run test:run file sessions  # Test one file
npm run test:run func cleanup   # Test by pattern
```

## 🔍 Debugging

```javascript
// Run only specific test
it.only('should return empty array', async () => { /* ... */ });

// Run only specific suite
describe.only('listSessions', () => { /* ... */ });
```

```bash
# Verbose output
npm run test:verbose

# Node debugger
node --inspect-brk --test tests/unit/tools/sessions.test.js
# Then open chrome://inspect
```

## 📝 Writing Tests

**Framework:** Node.js native test runner (`node:test`) - no external dependencies

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('My Feature', () => {
  before(async () => { /* setup */ });
  after(() => { /* cleanup */ });
  
  it('should do something', async () => {
    const result = await myFunction();
    assert.strictEqual(result, 'expected');
  });
});
```

**Best practices:**
- Use `strictEqual`, not `equal`
- Always await promises
- Clean up resources in `after()` hooks
- Keep tests isolated and independent

## 📈 CI/CD

```yaml
# GitHub Actions
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

## 📚 Resources

- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [MCP Protocol](https://modelcontextprotocol.io)
- [node-pty](https://github.com/microsoft/node-pty)

## 🧪 Development

Found a bug or have a feature request? Please report it on GitHub:

**[Report an Issue](https://github.com/bgbruno/bg-server-mcp-shell/issues)**

## 📄 License

MIT © [Bruno Garret](https://bgbruno.com)