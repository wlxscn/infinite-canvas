import { createApp } from './app.mjs';
import { validateEnv } from './config/env.mjs';

const { port } = validateEnv();
const app = createApp();

app.listen(port, '127.0.0.1', () => {
  console.log(`agent-api listening on http://127.0.0.1:${port}`);
});
