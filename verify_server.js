import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, 'build/index.js');
const serverProcess = spawn('node', [serverPath], {
    env: { ...process.env }
});

let buffer = '';

serverProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    buffer += chunk;

    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep the last incomplete line

    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            // Skip non-JSON lines (like server startup logs)
            if (!line.startsWith('{')) {
                console.log('Server Log:', line);
                continue;
            }
            const message = JSON.parse(line);
            console.log('Received:', message);

            if (message.result && message.result.tools) {
                console.log('Tools listed successfully.');
                // Now try to call a tool (expecting failure due to invalid file key, but checking connectivity)
                const callRequest = {
                    jsonrpc: '2.0',
                    id: 2,
                    method: 'tools/call',
                    params: {
                        name: 'get_file',
                        arguments: { file_key: 'invalid_key' }
                    }
                };
                serverProcess.stdin.write(JSON.stringify(callRequest) + '\n');
            } else if (message.id === 2) {
                console.log('Tool call response received.');
                serverProcess.kill();
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
        }
    }
});

serverProcess.stderr.on('data', (data) => {
    console.error('Server Error:', data.toString());
});

// Send initialize request
const initRequest = {
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
    }
};

serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');

// Send initialized notification
const initializedNotification = {
    jsonrpc: '2.0',
    method: 'notifications/initialized'
};
serverProcess.stdin.write(JSON.stringify(initializedNotification) + '\n');

// Send listTools request
const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
};
serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
