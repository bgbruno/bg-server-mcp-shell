# 🧪 Testing Documentation

Complete testing documentation for bg-server-mcp-shell.

---

## 📑 Table of Contents

- [Quick Start](#-quick-start)
- [Test Scripts - Differences](#-test-scripts---differences)
- [Running Tests](#-running-tests)
- [Test Structure](#-test-structure)
- [Test Coverage](#-test-coverage)
- [Practical Examples](#-practical-examples)
- [Debugging](#-debugging)
- [Writing Tests](#-writing-tests)
- [Output Comparison](#-output-comparison)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)
- [CI/CD](#-cicd)

---

## 🚀 Quick Start

```bash
# All tests
npm test

# Fast unit tests (ideal during development)
npm run test:unit

# Verbose output (for debugging)
npm run test:verbose

# Watch mode (TDD)
npm run test:watch

# Test runner helper (see below for details)
npm run test:run all
npm run test:run unit
npm run test:run func listSessions
```

---

## 📊 Test Scripts - Differences

### Quick Reference Table

| Command | What it runs | Duration | Output | When to use |
|---------|--------------|----------|--------|-------------|
| `npm test` | All (20 tests) | ~7s | Brief | Before commit, CI/CD |
| `npm run test:unit` | Unit (12 tests) | ~1s | Brief | Feature development |
| `npm run test:integration` | Integration (8 tests) | ~6s | Brief | Test workflow |
| `npm run test:watch` | All + auto-reload | ∞ | Brief | Active development (TDD) |
| `npm run test:verbose` | All + details | ~7s | **Detailed** | Debugging failures |
| `npm run test:run <args>` | Flexible | Varies | **Spec** | Targeted testing, patterns |

### Detailed Description

#### 1. `npm test` - Basic test run
```bash
npm test
```
- Runs: `tests/unit/**/*.test.js` + `tests/integration/**/*.test.js`
- Duration: ~7s
- Output: Brief summary (✔/✖)
- **When:** Before every commit, in CI/CD

#### 2. `npm run test:unit` - Fast unit tests
```bash
npm run test:unit
```
- Runs: ONLY `tests/unit/**/*.test.js`
- Duration: ~1s (fast!)
- Without slow integration tests
- **When:** During individual feature development

#### 3. `npm run test:integration` - End-to-end tests
```bash
npm run test:integration
```
- Runs: ONLY `tests/integration/**/*.test.js`
- Duration: ~6s (spawns real MCP servers)
- Tests complete workflow
- **When:** Testing the entire system

#### 4. `npm run test:watch` - Continuous testing
```bash
npm run test:watch
```
- Watches for file changes
- Automatically re-runs tests after save
- Press Ctrl+C to exit
- **When:** TDD (Test-Driven Development), active development

#### 5. `npm run test:verbose` - Detailed output
```bash
npm run test:verbose
```
- Same tests as `npm test`
- But shows names, times, details of each test
- Hierarchical structure (describe → it)
- **When:** Debugging failed tests

#### 6. `npm run test:run <args>` - Flexible test runner
```bash
npm run test:run all
npm run test:run unit
npm run test:run file sessions
npm run test:run func listSessions
```
- Flexible helper for targeted testing
- Smart file search, pattern matching
- Spec reporter output (detailed)
- **When:** Testing specific features, functions, or files
- **Examples:**
  - `npm run test:run` - shows help
  - `npm run test:run func "should return empty"` - pattern matching
  - `npm run test:run file control` - test specific file

---

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

---

## 📊 Test Coverage

### Unit tests cover:

**spawn-helper.test.js**
- ✅ PTY process spawning with various configurations
- ✅ Environment variable handling (COLOR, NO_COLOR, TERM)
- ✅ Working directory handling
- ✅ Cross-platform command execution
- ✅ Error handling (non-existent commands, invalid paths)

**process.test.js**
- ✅ `startProcessAndWait` - command execution, exit codes, timeouts
- ✅ `startProcessBackground` - non-blocking execution, session creation
- ✅ Custom working directory and environment variables
- ✅ Output buffering

**sessions.test.js**
- ✅ `listSessions` - empty list, active sessions, session status
- ✅ `getSessionOutput` - output retrieval, fromIndex parameter
- ✅ `cleanupSessions` - single session cleanup, bulk cleanup
- ✅ Session state tracking (isRunning, exitCode, outputLines)

**control.test.js**
- ✅ `writeInput` - sending input to processes, unicode handling
- ✅ `stopProcess` - process termination, session preservation
- ✅ Interactive processes (cat, bash)
- ✅ Multiple sequential writes

### Integration tests cover:

**mcp-server.test.js**
- ✅ MCP protocol initialization
- ✅ Tools listing
- ✅ Complete session lifecycle
- ✅ Interactive process workflow
- ✅ Multiple concurrent sessions
- ✅ Real-world scenarios (git, npm, ls)

### Test Mapping

| MCP Function | Test file | Test suite |
|-------------|------------|------------|
| `startProcessAndWait` | `tests/unit/tools/process.test.js` | `startProcessAndWait` |
| `startProcessBackground` | `tests/unit/tools/process.test.js` | `startProcessBackground` |
| `listSessions` | `tests/unit/tools/sessions.test.js` | `listSessions` |
| `getSessionOutput` | `tests/unit/tools/sessions.test.js` | `getSessionOutput` |
| `cleanupSessions` | `tests/unit/tools/sessions.test.js` | `cleanupSessions` |
| `writeInput` | `tests/unit/tools/control.test.js` | `writeInput` |
| `stopProcess` | `tests/unit/tools/control.test.js` | `stopProcess` |
| `spawnPtyProcess` | `tests/unit/spawn-helper.test.js` | `spawnPtyProcess` |
| End-to-end | `tests/integration/mcp-server.test.js` | all suites |

---

## 🎯 Running Tests

### Test Runner Helper - `tests/tests-run.sh`

Flexible test runner with multiple options for targeted testing.

**Why use the helper?**
- 🎯 Simple interface for complex test commands
- 🔍 Smart file search (no need to remember full paths)
- 📊 Consistent output formatting
- 🚀 Quick access to common test patterns
- 💡 Built-in help and examples

#### Using npm script (recommended)
```bash
# Help (shows all options)
npm run test:run

# All tests
npm run test:run all

# Unit / Integration
npm run test:run unit
npm run test:run integration

# Specific file
npm run test:run file sessions
npm run test:run file sessions.test.js
npm run test:run file mcp-server

# Specific function / pattern
npm run test:run func listSessions
npm run test:run func "should return empty"
npm run test:run func writeInput

# Watch mode
npm run test:run watch
```

#### Direct script call
```bash
# Alternative: call script directly
tests/tests-run.sh all
tests/tests-run.sh unit
tests/tests-run.sh func listSessions
```

### Node.js test runner (direct)

#### Specific file
```bash
# Basic run
node --test tests/unit/tools/sessions.test.js

# With detailed output
node --test --test-reporter=spec tests/unit/tools/sessions.test.js

# Watch mode
node --test --watch tests/unit/tools/sessions.test.js
```

#### Filter by name (pattern matching)
```bash
# All tests containing "listSessions"
node --test --test-name-pattern="listSessions" tests/**/*.test.js

# Regex pattern
node --test --test-name-pattern="should.*empty" tests/**/*.test.js

# Specific test suite
node --test --test-name-pattern="^getSessionOutput$" tests/unit/tools/sessions.test.js
```

#### Combined filters
```bash
# Specific file + pattern
node --test \
  --test-name-pattern="cleanup" \
  --test-reporter=spec \
  tests/unit/tools/sessions.test.js
```

---

## 💡 Practical Examples

### Workflow 1: Developing `listSessions` function
```bash
# 1. Start watch mode
npm run test:watch

# 2. Or only unit tests (faster)
npm run test:unit

# 3. Test fails? Use verbose
npm run test:verbose

# 4. Before commit
npm test
```

### Workflow 2: Test specific function
```bash
# Using helper script (npm)
npm run test:run func listSessions

# Or direct script
tests/tests-run.sh func listSessions

# Or direct node
node --test --test-name-pattern="listSessions" tests/**/*.test.js
```

### Workflow 3: Test all session functions
```bash
# Entire file via helper
npm run test:run file sessions

# Or direct script
tests/tests-run.sh file sessions

# Or direct node
node --test tests/unit/tools/sessions.test.js
```

### Workflow 4: Test specific scenario
```bash
# Pattern matching
npm run test:run func "empty array"

# Or direct script
tests/tests-run.sh func "empty array"

# Result: runs test "should return empty array when no sessions exist"
```

### Workflow 5: Debugging
```bash
# 1. Test failed, need details
npm run test:verbose

# 2. Want only that specific test
node --test --test-name-pattern="should return empty" tests/unit/tools/sessions.test.js

# 3. Or use it.only() in code (see Debugging section)
```

---

## 📺 Output Comparison

### 1. `npm test` (brief)
```
▶ listSessions
✔ listSessions (1580ms)
▶ getSessionOutput
✔ getSessionOutput (4516ms)

ℹ tests 12
ℹ pass 12
ℹ duration_ms 8380
```
**Characteristics:** Only suite summary, total times, pass/fail counts

### 2. `npm run test:verbose` (detailed)
```
▶ listSessions
  ✔ should return empty array when no sessions exist (52ms)
  ✔ should list active sessions (104ms)
  ✔ should show session status correctly (605ms)
  ✔ should track output line count (608ms)
✔ listSessions (1580ms)

ℹ tests 12
ℹ pass 12
```
**Characteristics:** Each individual test, names, individual times, hierarchical structure

### 3. `npm run test:unit` (fast)
```
▶ spawnPtyProcess
✔ spawnPtyProcess (73ms)
▶ Platform-specific behavior
✔ Platform-specific behavior (9ms)

ℹ tests 12
ℹ pass 12
ℹ duration_ms 100  ← Fast!
```
**Characteristics:** Only unit tests, ~100ms (vs 7s for everything)

### Performance Comparison

| Command | Test count | Time | Files |
|---------|------------|------|-------|
| `npm test` | 20 | ~7s | All |
| `npm run test:unit` | 12 | ~1s | Unit only |
| `npm run test:integration` | 8 | ~6s | Integration only |
| `npm run test:watch` | 20 | ∞ | All + watch |
| `npm run test:verbose` | 20 | ~7s | All + details |
| `npm run test:run <args>` | Varies | Varies | Flexible |

---

## 🔍 Debugging

### 1. In code - it.only()
```javascript
// Only this test will run
it.only('should return empty array', async () => {
  // ...
});

// This one will be skipped
it('should list active sessions', async () => {
  // ...
});
```

### 2. In code - describe.only()
```javascript
// Only this test suite will run
describe.only('listSessions', () => {
  it('test 1', () => {});
  it('test 2', () => {});
});

// This one will be skipped
describe('getSessionOutput', () => {
  it('test 3', () => {});
});
```

### 3. Node.js debugger
```bash
# Debug with breakpoint
node --inspect-brk --test tests/unit/tools/sessions.test.js

# Then in Chrome: chrome://inspect
```

### 4. Custom test reporters
```bash
# TAP reporter (detailed)
node --test --test-reporter=tap tests/**/*.test.js

# Spec reporter (readable)
node --test --test-reporter=spec tests/**/*.test.js

# JSON output
node --test --test-reporter=json tests/**/*.test.js > results.json

# Minimal output
node --test --test-reporter=dot tests/**/*.test.js
```

---

## 📝 Writing Tests

### Test Framework

We use **Node.js native test runner** (`node:test`):
- ✅ No external dependencies
- ✅ Built-in since Node 18+
- ✅ Async/await support
- ✅ Describe/it syntax
- ✅ Before/after hooks
- ✅ Assert API

### Unit test example
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('My Feature', () => {
  it('should do something', async () => {
    const result = await myFunction();
    assert.strictEqual(result, 'expected');
  });
});
```

### MCP test example
```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'crypto';

describe('My MCP Tool', () => {
  let testServer;
  
  before(async () => {
    testServer = createTestServer();
    // Initialize...
  });
  
  after(() => {
    testServer.close();
  });
  
  it('should call tool successfully', async () => {
    const id = randomUUID();
    
    testServer.send({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'myTool',
        arguments: { foo: 'bar' }
      }
    });
    
    const response = await testServer.waitForResponse(id);
    assert.strictEqual(response.result.structuredContent.ok, true);
  });
});
```

---

## ✅ Best Practices

1. **Isolation** - Each test should be independent
2. **Cleanup** - Always clean up resources in `after()` hooks
3. **Timeouts** - Use reasonable timeouts (default 5s)
4. **Assertions** - Use strict assertions (`strictEqual`, not `equal`)
5. **Async/await** - Always await promises in tests
6. **Descriptive names** - Descriptive test names (should...)
7. **Arrange-Act-Assert** - Structure tests clearly
8. **One assertion per test** - Prefer simplicity

---

## 🔧 Troubleshooting

### Test timeout
```javascript
// Increase timeout for long operations
await testServer.waitForResponse(id, 10000); // 10 seconds
```

### Flaky tests
```javascript
// Add wait for async operations
await new Promise(resolve => setTimeout(resolve, 500));
```

### Session cleanup
```javascript
// Always cleanup sessions after tests
after(async () => {
  await cleanupAllSessions();
  testServer.close();
});
```

### Debug failing test
```bash
# 1. Verbose output
npm run test:verbose

# 2. Specific test
node --test --test-name-pattern="failing test name" tests/**/*.test.js

# 3. Use it.only() in code
```

---

## 📈 CI/CD

### GitHub Actions
```yaml
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

### GitLab CI
```yaml
test:
  image: node:18
  script:
    - npm install
    - npm test
```

---

## 💡 Pro Tips

### Combine with grep
```bash
# Verbose output only for sessions tests
npm run test:verbose | grep -A 20 "▶ listSessions"
```

### Redirect to file
```bash
# Save verbose output for later analysis
npm run test:verbose > test-results.txt 2>&1
```

### Watch only unit tests
```bash
node --test --watch tests/unit/**/*.test.js
```

### Verbose only for failures
```bash
# If test fails, use verbose to find out why
npm test || npm run test:verbose
```

### List all tests
```bash
find tests -name "*.test.js" -type f
```

---

## 🎯 Test Metrics

- **Unit tests:** 30+ test cases
- **Integration tests:** 10+ scenarios
- **Code coverage:** Tools + Core logic
- **Platform support:** macOS, Linux, Windows
- **Node versions:** 18+
- **Total duration:** ~7s (all tests)

---

## 📚 Additional Resources

- [Node.js Test Runner Docs](https://nodejs.org/api/test.html)
- [MCP Protocol Spec](https://modelcontextprotocol.io)
- [node-pty Documentation](https://github.com/microsoft/node-pty)
