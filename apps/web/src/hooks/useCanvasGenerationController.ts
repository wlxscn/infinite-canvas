import { useEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { AgentEffect } from '@infinite-canvas/shared/tool-effects';
import { getCanvasNodeBounds, normalizeBounds, screenToWorld } from '@infinite-canvas/canvas-engine';
import { generateImage, generateVideo } from '../features/chat/api/chat-client';
import {
  commitProject,
  getNodeById,
  replaceProjectNoHistory,
  setSelectedId,
  setTool,
  upsertAsset,
  upsertJob,
} from '../state/store';
import type {
  AssetRecord,
  CanvasNode,
  CanvasProject,
  CanvasStoreState,
  GenerationJob,
  TextNode,
} from '../types/canvas';
import { fitAssetSize } from '../utils/assetSizing';
import { createId } from '../utils/id';
import { captureVideoFrame } from '../utils/videoFrame';

function createPendingJob(prompt: string, mediaType: GenerationJob['mediaType'] = 'image'): GenerationJob {
  const now = Date.now();
  return {
    id: createId('job'),
    prompt,
    mediaType,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

function createGeneratedAsset({
  mediaType,
  sourceJobId,
  response,
}: {
  mediaType: AssetRecord['type'];
  sourceJobId: string;
  response:
    | Awaited<ReturnType<typeof generateImage>>
    | Awaited<ReturnType<typeof generateVideo>>;
}): AssetRecord {
  const now = Date.now();

  if (mediaType === 'video') {
    const videoResponse = response as Awaited<ReturnType<typeof generateVideo>>;
    return {
      id: createId('asset'),
      type: 'video',
      name: `Generated video ${new Date().toLocaleTimeString()}`,
      mimeType: videoResponse.mimeType ?? 'video/mp4',
      src: videoResponse.videoUrl,
      posterSrc: videoResponse.posterUrl ?? undefined,
      width: videoResponse.width,
      height: videoResponse.height,
      durationSeconds: videoResponse.durationSeconds,
      origin: 'generated',
      createdAt: now,
      sourceJobId,
    };
  }

  const imageResponse = response as Awaited<ReturnType<typeof generateImage>>;
  return {
    id: createId('asset'),
    type: 'image',
    name: `Generated image ${new Date().toLocaleTimeString()}`,
    mimeType: 'image/jpeg',
    src: imageResponse.imageUrl,
    width: imageResponse.width,
    height: imageResponse.height,
    origin: 'generated',
    createdAt: now,
    sourceJobId,
  };
}

function createGeneratedNode(asset: AssetRecord, center: { x: number; y: number }): CanvasNode {
  const { width, height } = fitAssetSize(asset);

  return {
    id: createId('node'),
    type: asset.type,
    assetId: asset.id,
    x: center.x - width / 2,
    y: center.y - height / 2,
    w: width,
    h: height,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

interface UseCanvasGenerationControllerOptions {
  selectedId: string | null;
  setState: Dispatch<SetStateAction<CanvasStoreState>>;
  stageContainerRef: RefObject<HTMLElement | null>;
}

export function useCanvasGenerationController({
  selectedId,
  setState,
  stageContainerRef,
}: UseCanvasGenerationControllerOptions) {
  const [prompt, setPrompt] = useState('editorial poster about infinite canvas creativity');
  const [generationMediaType, setGenerationMediaType] = useState<AssetRecord['type']>('image');
  const promptRef = useRef(prompt);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  function updateVideoFrame(assetId: string, frameSrc: string): void {
    setState((prev) =>
      replaceProjectNoHistory(prev, {
        ...prev.project,
        assets: prev.project.assets.map((asset) =>
          asset.id === assetId && asset.type === 'video' && !asset.frameSrc ? { ...asset, frameSrc } : asset,
        ),
      }),
    );
  }

  function captureVideoAssetFrame(asset: AssetRecord): void {
    if (asset.type !== 'video' || asset.frameSrc) {
      return;
    }

    void captureVideoFrame(asset.src)
      .then((frameSrc) => updateVideoFrame(asset.id, frameSrc))
      .catch((error) => {
        console.warn('Failed to capture video frame preview', error);
      });
  }

  function insertAsset(asset: AssetRecord): void {
    setState((prev) => {
      const viewport = prev.project.board.viewport;
      const container = stageContainerRef.current;
      const screenCenter = {
        x: container ? container.clientWidth / 2 : 640,
        y: container ? container.clientHeight / 2 : 360,
      };
      const worldCenter = screenToWorld(screenCenter, viewport);
      const node = createGeneratedNode(asset, worldCenter);

      const nextProject: CanvasProject = {
        ...prev.project,
        assets: upsertAsset(prev.project.assets, asset),
        board: {
          ...prev.project.board,
          nodes: [...prev.project.board.nodes, node],
        },
      };
      const nextState = commitProject(prev, nextProject);
      return setSelectedId(nextState, node.id);
    });

    captureVideoAssetFrame(asset);
  }

  async function handleUpload(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) {
      return;
    }

    const src = await readFileAsDataUrl(file);
    const asset: AssetRecord = {
      id: createId('asset'),
      type: 'image',
      name: file.name,
      mimeType: file.type || 'image/png',
      src,
      width: 1200,
      height: 800,
      origin: 'upload',
      createdAt: Date.now(),
    };

    setState((prev) =>
      commitProject(prev, {
        ...prev.project,
        assets: upsertAsset(prev.project.assets, asset),
      }),
    );
  }

  async function startMockGeneration(promptOverride?: string, mediaType: AssetRecord['type'] = 'image'): Promise<void> {
    const trimmedPrompt = (promptOverride ?? promptRef.current).trim();
    if (!trimmedPrompt) {
      return;
    }

    const job = createPendingJob(trimmedPrompt, mediaType);

    setState((prev) =>
      replaceProjectNoHistory(prev, {
        ...prev.project,
        jobs: upsertJob(prev.project.jobs, job),
      }),
    );

    try {
      const generated =
        mediaType === 'video'
          ? await generateVideo({ prompt: trimmedPrompt })
          : await generateImage({ prompt: trimmedPrompt });
      const asset = createGeneratedAsset({
        mediaType,
        sourceJobId: job.id,
        response: generated,
      });

      setState((prev) =>
        replaceProjectNoHistory(prev, {
          ...prev.project,
          assets: upsertAsset(prev.project.assets, asset),
          jobs: upsertJob(prev.project.jobs, {
            ...job,
            status: 'success',
            updatedAt: Date.now(),
            assetId: asset.id,
          }),
        }),
      );
      captureVideoAssetFrame(asset);
    } catch (error) {
      setState((prev) =>
        replaceProjectNoHistory(prev, {
          ...prev.project,
          jobs: upsertJob(prev.project.jobs, {
            ...job,
            status: 'failed',
            updatedAt: Date.now(),
            error: error instanceof Error ? error.message : `${mediaType === 'video' ? 'Video' : 'Image'} generation failed.`,
          }),
        }),
      );
    }
  }

  function insertTextNode(text: string): void {
    setState((prev) => {
      const selected = getNodeById(prev.project.board.nodes, selectedIdRef.current);
      const bounds = selected ? normalizeBounds(getCanvasNodeBounds(selected, prev.project.board)) : { x: -120, y: -40, w: 0, h: 0 };

      const textNode: TextNode = {
        id: createId('node'),
        type: 'text',
        x: bounds.x,
        y: bounds.y - 80,
        w: 260,
        h: 84,
        text,
        color: '#0f172a',
        fontSize: 22,
        fontFamily: 'Space Grotesk, Avenir Next, Segoe UI, sans-serif',
      };

      const nextProject: CanvasProject = {
        ...prev.project,
        board: {
          ...prev.project.board,
          nodes: [...prev.project.board.nodes, textNode],
        },
      };
      const nextState = commitProject(prev, nextProject);
      const selectedState = setSelectedId(nextState, textNode.id);
      return setTool(selectedState, 'select');
    });
  }

  function applyAgentEffects(effects: AgentEffect[]): void {
    effects.forEach((effect) => {
      if (effect.type === 'insert-text') {
        insertTextNode(effect.text);
        return;
      }

      if (effect.type === 'insert-image') {
        setPrompt(effect.prompt);
        insertAsset({
          id: createId('asset'),
          type: 'image',
          name: `Generated ${new Date().toLocaleTimeString()}`,
          mimeType: effect.mimeType ?? 'image/jpeg',
          src: effect.imageUrl,
          width: effect.width,
          height: effect.height,
          origin: 'generated',
          createdAt: Date.now(),
        });
        return;
      }

      if (effect.type === 'insert-video') {
        setPrompt(effect.prompt);
        insertAsset({
          id: createId('asset'),
          type: 'video',
          name: `Generated video ${new Date().toLocaleTimeString()}`,
          mimeType: effect.mimeType ?? 'video/mp4',
          src: effect.videoUrl,
          posterSrc: effect.posterUrl ?? undefined,
          width: effect.width,
          height: effect.height,
          durationSeconds: effect.durationSeconds,
          origin: 'generated',
          createdAt: Date.now(),
        });
        return;
      }

      if (effect.type === 'style-variation') {
        setPrompt(effect.prompt);
        void startMockGeneration(effect.prompt, effect.mediaType ?? 'image');
        return;
      }

      if (effect.type === 'start-generation') {
        setPrompt(effect.prompt);
        void startMockGeneration(effect.prompt, effect.mediaType ?? 'image');
      }
    });
  }

  return {
    prompt,
    setPrompt,
    generationMediaType,
    setGenerationMediaType,
    handleUpload,
    insertAsset,
    startMockGeneration,
    applyAgentEffects,
  };
}
