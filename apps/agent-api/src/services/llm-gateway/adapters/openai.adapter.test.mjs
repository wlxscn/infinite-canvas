import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiAdapter } from './openai.adapter.mjs';
import { LLM_ERROR_CODES } from '../index.mjs';

function createEnv() {
  return {
    openAiApiKey: 'openai-key',
    openAiBaseUrl: 'https://openai.invalid/v1',
    openAiModel: 'gpt-4o-mini',
    openAiTranscriptionModel: 'gpt-4o-mini-transcribe',
    transcriptionTimeoutMs: 1000,
  };
}

test('openai adapter supports normalized tool calling', async () => {
  const adapter = createOpenAiAdapter({
    env: createEnv(),
    fetchImpl: async () =>
      Response.json({
        id: 'chatcmpl_1',
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  function: {
                    name: 'change_canvas_style',
                    arguments: '{"prompt":"retro layout"}',
                  },
                },
              ],
            },
          },
        ],
      }),
  });

  const result = await adapter.callTools({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'restyle this' }],
    tools: [],
  });

  assert.equal(result.provider, 'openai');
  assert.equal(result.toolCalls[0].name, 'change_canvas_style');
  assert.deepEqual(result.toolCalls[0].arguments, { prompt: 'retro layout' });
});

test('openai adapter returns transcription text', async () => {
  const adapter = createOpenAiAdapter({
    env: createEnv(),
    fetchImpl: async () => Response.json({ text: '生成一张海报' }),
  });

  const result = await adapter.transcribe({
    model: 'gpt-4o-mini-transcribe',
    audioBuffer: Buffer.from('hello'),
    mimeType: 'audio/webm',
    fileName: 'voice.webm',
    language: 'zh',
  });

  assert.equal(result.text, '生成一张海报');
});

test('openai adapter rejects invalid transcription responses', async () => {
  const adapter = createOpenAiAdapter({
    env: createEnv(),
    fetchImpl: async () => Response.json({ text: '' }),
  });

  await assert.rejects(
    () =>
      adapter.transcribe({
        model: 'gpt-4o-mini-transcribe',
        audioBuffer: Buffer.from('hello'),
        mimeType: 'audio/webm',
        fileName: 'voice.webm',
      }),
    (error) => {
      assert.equal(error.code, LLM_ERROR_CODES.INVALID_TRANSCRIPTION_RESPONSE);
      return true;
    },
  );
});
