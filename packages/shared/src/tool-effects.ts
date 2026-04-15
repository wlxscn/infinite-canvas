export type GenerationMediaType = 'image' | 'video';

export type AgentEffect =
  | { type: 'insert-text'; text: string }
  | { type: 'insert-image'; prompt: string; imageUrl: string; width: number; height: number; mimeType?: string }
  | {
      type: 'insert-video';
      prompt: string;
      videoUrl: string;
      width: number;
      height: number;
      posterUrl?: string | null;
      durationSeconds?: number;
      requestId?: string | null;
      taskId?: string | null;
      fileId?: string | null;
      resolution?: string;
      mimeType?: string;
    }
  | { type: 'start-generation'; prompt: string; mediaType?: GenerationMediaType }
  | { type: 'style-variation'; prompt: string; mediaType?: GenerationMediaType }
  | { type: 'noop' };
