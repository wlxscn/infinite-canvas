await import('../src/app.mjs');
await import('../src/config/env.mjs');
await import('../src/controllers/chat.controller.mjs');
await import('../src/prompts/design-agent.prompt.mjs');
await import('../src/routes/chat.mjs');
await import('../src/routes/health.mjs');
await import('../src/services/conversation.service.mjs');
await import('../src/services/assistant-message.service.mjs');
await import('../src/services/minimax.service.mjs');
await import('../src/services/openai.service.mjs');
await import('../src/services/tool-runner.service.mjs');
await import('../src/tools/add-text.tool.mjs');
await import('../src/tools/change-style.tool.mjs');
await import('../src/tools/generate-variant.tool.mjs');

console.log('agent-api modules verified');
