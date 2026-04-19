import { randomUUID } from 'node:crypto';

export function createConversationService({ createId = randomUUID } = {}) {
  return {
    prepare(body) {
      const conversationId = body?.conversationId ?? createId();
      const previousResponseId = typeof body?.previousResponseId === 'string' ? body.previousResponseId : null;

      return {
        conversationId,
        previousResponseId,
        responseId: createId(),
        providerState: {
          previousResponseId,
        },
      };
    },
  };
}
