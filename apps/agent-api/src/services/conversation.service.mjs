import { randomUUID } from 'node:crypto';

export function createConversationService() {
  return {
    prepare(body) {
      return {
        conversationId: body?.conversationId ?? randomUUID(),
        previousResponseId: body?.previousResponseId ?? randomUUID(),
      };
    },
  };
}
