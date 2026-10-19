import { spawn } from 'node:child_process';
const children = [spawn(process.execPath, ['--watch', 'server/index.ts'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '3000', '--host', '127.0.0.1', '--strictPort'], { stdio: 'inherit' })];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(child => child.kill()); process.exitCode = code; }
children.forEach(child => { child.on('exit', code => stop(code || 0)); child.on('error', () => stop(1)); });
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
