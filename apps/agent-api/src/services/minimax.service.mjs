import { getEnv } from '../config/env.mjs';

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504, 529]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAspectRatioForPrompt(prompt) {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes('竖版') || lowerPrompt.includes('portrait') || lowerPrompt.includes('9:16')) {
    return '9:16';
  }

  if (lowerPrompt.includes('方图') || lowerPrompt.includes('square') || lowerPrompt.includes('1:1')) {
    return '1:1';
  }

  return '16:9';
}

function normalizeDownloadUrl(downloadUrl) {
  if (typeof downloadUrl !== 'string') {
    return null;
  }

  const trimmed = downloadUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed}`;
}

export function createMiniMaxService() {
  return {
    async generateImage({ prompt, aspectRatio }) {
      const env = getEnv();

      if (!env.minimaxApiKey) {
        return null;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 600_000);
      const requestPayload = {
        model: env.minimaxImageModel,
        prompt,
        aspect_ratio: aspectRatio || getAspectRatioForPrompt(prompt),
        n: 1,
        prompt_optimizer: true,
      };

      console.log('[agent-api/minimax] image:start', {
        url: `${env.minimaxImageBaseUrl}/image_generation`,
        model: env.minimaxImageModel,
        aspectRatio: requestPayload.aspect_ratio,
        promptLength: prompt.length,
        prompt: prompt,
        requestPayload,
      });

      try {
        const response = await fetch(`${env.minimaxImageBaseUrl}/image_generation`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.minimaxApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('[agent-api/minimax] image failed', {
            status: response.status,
            body: errorText.slice(0, 500),
          });
          return null;
        }

        const payload = await response.json();
        console.log('[agent-api/minimax] image:response', {
          status: response.status,
          body: payload,
        });
        const imageUrl = payload?.data?.image_urls?.[0] ?? null;

        console.log('[agent-api/minimax] image:success', {
          imageCount: Array.isArray(payload?.data?.image_urls) ? payload.data.image_urls.length : 0,
          requestId: payload?.id ?? null,
          statusCode: payload?.base_resp?.status_code ?? null,
        });

        if (!imageUrl) {
          console.warn('[agent-api/minimax] image missing url', payload);
          return null;
        }

        return {
          requestId: payload?.id ?? null,
          imageUrl,
          aspectRatio: requestPayload.aspect_ratio,
          width:
            requestPayload.aspect_ratio === '1:1'
              ? 1024
              : requestPayload.aspect_ratio === '9:16'
                ? 720
                : requestPayload.aspect_ratio === '4:3'
                  ? 1152
                  : requestPayload.aspect_ratio === '3:2'
                    ? 1248
                    : requestPayload.aspect_ratio === '2:3'
                      ? 832
                      : requestPayload.aspect_ratio === '3:4'
                        ? 864
                        : requestPayload.aspect_ratio === '21:9'
                          ? 1344
                          : 1280,
          height:
            requestPayload.aspect_ratio === '1:1'
              ? 1024
              : requestPayload.aspect_ratio === '9:16'
                ? 1280
                : requestPayload.aspect_ratio === '4:3'
                  ? 864
                  : requestPayload.aspect_ratio === '3:2'
                    ? 832
                    : requestPayload.aspect_ratio === '2:3'
                      ? 1248
                      : requestPayload.aspect_ratio === '3:4'
                        ? 1152
                        : requestPayload.aspect_ratio === '21:9'
                          ? 576
                          : 720,
          raw: payload,
        };
      } catch (error) {
        console.warn('[agent-api/minimax] image error', {
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
    async generateVideo({ prompt, durationSeconds, resolution }) {
      const env = getEnv();

      if (!env.minimaxApiKey) {
        return null;
      }

      const requestPayload = {
        model: env.minimaxVideoModel,
        prompt,
        duration: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : env.minimaxVideoDurationSeconds,
        resolution: typeof resolution === 'string' && resolution.trim() ? resolution.trim() : env.minimaxVideoResolution,
        aigc_watermark: false,
      };

      console.log('[agent-api/minimax] video:start', {
        url: `${env.minimaxBaseUrl}/video_generation`,
        model: env.minimaxVideoModel,
        duration: requestPayload.duration,
        resolution: requestPayload.resolution,
        promptLength: prompt.length,
        prompt,
        requestPayload,
      });

      const createController = new AbortController();
      const createTimeout = setTimeout(() => createController.abort(), 60_000);

      try {
        const createResponse = await fetch(`${env.minimaxBaseUrl}/video_generation`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.minimaxApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
          signal: createController.signal,
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.warn('[agent-api/minimax] video create failed', {
            status: createResponse.status,
            body: errorText.slice(0, 500),
          });
          return null;
        }

        const createPayload = await createResponse.json();
        console.log('[agent-api/minimax] video:create-response', {
          status: createResponse.status,
          body: createPayload,
        });
        const taskId = createPayload?.task_id ?? null;

        console.log('[agent-api/minimax] video:task-created', {
          taskId,
          requestId: createPayload?.id ?? null,
          statusCode: createPayload?.base_resp?.status_code ?? null,
        });

        if (!taskId) {
          console.warn('[agent-api/minimax] video missing task id', createPayload);
          return null;
        }

        const deadline = Date.now() + env.minimaxVideoTimeoutMs;
        let statusPayload = null;

        while (Date.now() < deadline) {
          await sleep(env.minimaxVideoPollIntervalMs);

          const statusController = new AbortController();
          const statusTimeout = setTimeout(() => statusController.abort(), 15_000);

          try {
            const statusResponse = await fetch(
              `${env.minimaxBaseUrl}/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
              {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${env.minimaxApiKey}`,
                },
                signal: statusController.signal,
              },
            );

            if (!statusResponse.ok) {
              const errorText = await statusResponse.text();
              console.warn('[agent-api/minimax] video status failed', {
                taskId,
                status: statusResponse.status,
                body: errorText.slice(0, 500),
              });

              if (!RETRYABLE_STATUS_CODES.has(statusResponse.status)) {
                return null;
              }

              continue;
            }

            statusPayload = await statusResponse.json();
            console.log('[agent-api/minimax] video:status-response', {
              taskId,
              statusCode: statusResponse.status,
              body: statusPayload,
            });
            const status = String(statusPayload?.status ?? '').toLowerCase();

            console.log('[agent-api/minimax] video:status', {
              taskId,
              status: statusPayload?.status ?? null,
              fileId: statusPayload?.file_id ?? null,
            });

            if (status === 'success') {
              break;
            }

            if (status === 'fail' || status === 'failed') {
              console.warn('[agent-api/minimax] video generation failed', {
                taskId,
                status: statusPayload?.status ?? null,
                body: statusPayload,
              });
              return null;
            }
          } catch (error) {
            console.warn('[agent-api/minimax] video status error', {
              taskId,
              message: error instanceof Error ? error.message : String(error),
            });
          } finally {
            clearTimeout(statusTimeout);
          }
        }

        if (!statusPayload) {
          console.warn('[agent-api/minimax] video timed out waiting for status', {
            taskId,
            timeoutMs: env.minimaxVideoTimeoutMs,
          });
          return null;
        }

        const fileId = statusPayload?.file_id ?? null;
        if (!fileId) {
          console.warn('[agent-api/minimax] video missing file id', statusPayload);
          return null;
        }

        const fileController = new AbortController();
        const fileTimeout = setTimeout(() => fileController.abort(), 15_000);

        try {
          const fileResponse = await fetch(`${env.minimaxBaseUrl}/files/retrieve?file_id=${encodeURIComponent(fileId)}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${env.minimaxApiKey}`,
            },
            signal: fileController.signal,
          });

          if (!fileResponse.ok) {
            const errorText = await fileResponse.text();
            console.warn('[agent-api/minimax] video file retrieval failed', {
              taskId,
              fileId,
              status: fileResponse.status,
              body: errorText.slice(0, 500),
            });
            return null;
          }

          const filePayload = await fileResponse.json();
          console.log('[agent-api/minimax] video:file-response', {
            taskId,
            fileId,
            statusCode: fileResponse.status,
            body: filePayload,
          });
          const videoUrl = normalizeDownloadUrl(filePayload?.file?.download_url ?? null);

          if (!videoUrl) {
            console.warn('[agent-api/minimax] video missing download url', {
              taskId,
              fileId,
              payload: filePayload,
            });
            return null;
          }

          const width = Number.isFinite(statusPayload?.video_width) ? statusPayload.video_width : 1280;
          const height = Number.isFinite(statusPayload?.video_height) ? statusPayload.video_height : 720;

          console.log('[agent-api/minimax] video:success', {
            taskId,
            fileId,
            width,
            height,
          });

          return {
            requestId: createPayload?.id ?? null,
            taskId,
            fileId,
            videoUrl,
            posterUrl: null,
            width,
            height,
            durationSeconds: requestPayload.duration,
            resolution: requestPayload.resolution,
            raw: {
              createPayload,
              statusPayload,
              filePayload,
            },
          };
        } finally {
          clearTimeout(fileTimeout);
        }
      } catch (error) {
        console.warn('[agent-api/minimax] video error', {
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      } finally {
        clearTimeout(createTimeout);
      }
    },
  };
}
