#!/bin/bash

echo "🧪 Testing MCP Shell Server"
echo "=============================="
echo ""

# Start server in background and communicate via named pipe
FIFO=$(mktemp -u)
mkfifo "$FIFO"

# Start server with output to file
node bg-server-mcp-shell.js < "$FIFO" > /tmp/mcp-output.txt 2>&1 &
SERVER_PID=$!

# Open FIFO for writing
exec 3>"$FIFO"

sleep 0.5

echo "1️⃣  Initialize"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"bash-test","version":"1.0.0"}}}' >&3
sleep 0.3
grep '"id":1' /tmp/mcp-output.txt | tail -1
echo ""

echo "2️⃣  List tools"
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' >&3
sleep 0.3
grep '"id":2' /tmp/mcp-output.txt | tail -1 | jq '.result.tools[] | {name, title}'
echo ""

echo "3️⃣  Start process (echo test)"
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"startProcess","arguments":{"cmd":"echo","args":["Hello from MCP! 🚀"]}}}' >&3
sleep 0.5
SESSION_ID=$(grep '"id":3' /tmp/mcp-output.txt | tail -1 | jq -r '.result.structuredContent.sessionId')
echo "   SessionId: $SESSION_ID"
echo ""

echo "4️⃣  Get session output"
echo "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"getSessionOutput\",\"arguments\":{\"sessionId\":\"$SESSION_ID\"}}}" >&3
sleep 0.5
grep '"id":4' /tmp/mcp-output.txt | tail -1 | jq '.result.structuredContent | {isRunning, exitCode, outputLines: (.output | length)}'
echo "   Output data:"
grep '"id":4' /tmp/mcp-output.txt | tail -1 | jq -r '.result.structuredContent.output[] | select(.type=="stdout") | .data'
echo ""

echo "5️⃣  List sessions"
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"listSessions","arguments":{}}}' >&3
sleep 0.3
grep '"id":5' /tmp/mcp-output.txt | tail -1 | jq '.result.structuredContent.sessions'
echo ""

echo "6️⃣  Start long-running process (sleep)"
echo '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"startProcess","arguments":{"cmd":"bash","args":["-c","echo Starting; sleep 2; echo Done"]}}}' >&3
sleep 0.3
SESSION_ID2=$(grep '"id":6' /tmp/mcp-output.txt | tail -1 | jq -r '.result.structuredContent.sessionId')
echo "   SessionId: $SESSION_ID2"
sleep 1
echo ""

echo "7️⃣  Get output while running"
echo "{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"tools/call\",\"params\":{\"name\":\"getSessionOutput\",\"arguments\":{\"sessionId\":\"$SESSION_ID2\"}}}" >&3
sleep 0.3
grep '"id":7' /tmp/mcp-output.txt | tail -1 | jq '.result.structuredContent | {isRunning, outputLines: (.output | length)}'
echo ""

echo "8️⃣  Stop process"
echo "{\"jsonrpc\":\"2.0\",\"id\":8,\"method\":\"tools/call\",\"params\":{\"name\":\"stopProcess\",\"arguments\":{\"sessionId\":\"$SESSION_ID2\"}}}" >&3
sleep 0.3
grep '"id":8' /tmp/mcp-output.txt | tail -1 | jq '.result.structuredContent'
echo ""

echo "9️⃣  Cleanup sessions"
echo '{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"cleanupSessions","arguments":{}}}' >&3
sleep 0.3
grep '"id":9' /tmp/mcp-output.txt | tail -1 | jq '.result.structuredContent'
echo ""

echo "🔟 Real project test: npm run dev"
# Replace with your own project path for local testing
PROJECT_PATH="/path/to/your/project"
echo "{\"jsonrpc\":\"2.0\",\"id\":10,\"method\":\"tools/call\",\"params\":{\"name\":\"startProcess\",\"arguments\":{\"cmd\":\"npm\",\"args\":[\"run\",\"dev\"],\"cwd\":\"$PROJECT_PATH\"}}}" >&3
sleep 0.5
SESSION_ID3=$(grep '"id":10' /tmp/mcp-output.txt | tail -1 | jq -r '.result.structuredContent.sessionId')
echo "   SessionId: $SESSION_ID3"
echo "   Waiting for Vite to start..."
sleep 3
echo ""

echo "1️⃣1️⃣  Get npm run output"
echo "{\"jsonrpc\":\"2.0\",\"id\":11,\"method\":\"tools/call\",\"params\":{\"name\":\"getSessionOutput\",\"arguments\":{\"sessionId\":\"$SESSION_ID3\"}}}" >&3
sleep 0.5
echo "   Status:"
grep '"id":11' /tmp/mcp-output.txt | tail -1 | jq '.result.structuredContent | {isRunning, exitCode, outputLines: (.output | length)}'
echo ""
echo "   Last 10 lines of output:"
grep '"id":11' /tmp/mcp-output.txt | tail -1 | jq -r '.result.structuredContent.output[-10:] | .[] | select(.type=="stdout") | .data' | head -10
echo ""

echo "✅ Test completed!"
echo ""
echo "📝 Note: npm run kill+dev (SessionId: $SESSION_ID3) is still running in MCP server (PID: $SERVER_PID)"
echo "   To view output: cat /tmp/mcp-output.txt"
echo "   To stop server: kill $SERVER_PID"
echo ""
echo "Press Ctrl+C to stop server and cleanup..."
echo ""

# Keep server running and show live output
tail -f /tmp/mcp-output.txt
