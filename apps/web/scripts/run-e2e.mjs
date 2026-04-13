import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(webRoot, '..');
const webUrl = 'http://127.0.0.1:45173';

function waitForExit(child) {
  return new Promise((resolvePromise) => {
    child.on('exit', (code, signal) => {
      resolvePromise({ code, signal });
    });
  });
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
      // Keep polling until the stack is reachable.
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

const stack = spawn('node', ['scripts/e2e-stack.mjs'], {
  cwd: appRoot,
  stdio: 'inherit',
});

let stackClosed = false;

stack.on('exit', () => {
  stackClosed = true;
});

function shutdown() {
  if (!stackClosed) {
    stack.kill('SIGTERM');
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);

try {
  await waitForUrl(webUrl);

  const tests = spawn('pnpm', ['exec', 'playwright', 'test'], {
    cwd: appRoot,
    stdio: 'inherit',
  });

  const result = await waitForExit(tests);
  process.exitCode = result.code ?? 1;
} finally {
  shutdown();
  await waitForExit(stack);
}
