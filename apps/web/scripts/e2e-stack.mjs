import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const agentApiRoot = resolve(webRoot, '../agent-api');
const webUrl = 'http://127.0.0.1:45173';
const apiUrl = 'http://127.0.0.1:45188/health';

function startProcess(command, args, options) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...options,
  });

  child.on('exit', (code, signal) => {
    if (signal === 'SIGTERM' || signal === 'SIGINT') {
      return;
    }

    if (code !== 0) {
      process.exitCode = code ?? 1;
    }
  });

  return child;
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the service is up or the timeout elapses.
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

const webChild = startProcess('pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--port', '45173'], {
  cwd: webRoot,
  env: {
    ...process.env,
    VITE_AGENT_API_URL: 'http://127.0.0.1:45188/chat',
  },
});

const apiChild = startProcess('pnpm', ['start'], {
  cwd: agentApiRoot,
  env: {
    ...process.env,
    PORT: '45188',
    CORS_ORIGIN: webUrl,
  },
});

let resolved = false;
let resolveShutdown;

const shutdownPromise = new Promise((resolvePromise) => {
  resolveShutdown = () => {
    if (!resolved) {
      resolved = true;
      resolvePromise();
    }
  };
});

function shutdown() {
  webChild.kill('SIGTERM');
  apiChild.kill('SIGTERM');
  resolveShutdown();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);

await Promise.all([waitForUrl(webUrl), waitForUrl(apiUrl)]);

console.log(`e2e stack ready at ${webUrl}`);

await shutdownPromise;
