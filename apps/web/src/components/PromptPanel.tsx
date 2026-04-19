import type { RefObject } from 'react';
import type { AssetRecord, GenerationJob } from '../types/canvas';

interface PromptPanelProps {
  prompt: string;
  generationMediaType: AssetRecord['type'];
  jobs: GenerationJob[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPromptChange: (value: string) => void;
  onMediaTypeChange: (mediaType: AssetRecord['type']) => void;
  onStartGeneration: () => void;
  onImportReference: () => void;
  onUpload: (files: FileList | null) => void;
}

export function PromptPanel({
  prompt,
  generationMediaType,
  jobs,
  fileInputRef,
  onPromptChange,
  onMediaTypeChange,
  onStartGeneration,
  onImportReference,
  onUpload,
}: PromptPanelProps) {
  const generationButtonLabel = generationMediaType === 'video' ? '生成首版视频' : '生成首版画面';

  return (
    <section className="floating-card prompt-panel">
      <p className="section-kicker">Start Here</p>
      <div className="prompt-heading">
        <strong>先定一张主画面</strong>
        <span>用一句描述开启当前画板的第一版视觉方向</span>
      </div>
      <div className="generation-mode-toggle" role="group" aria-label="生成类型">
        <button
          className={generationMediaType === 'image' ? 'mode-chip active' : 'mode-chip'}
          type="button"
          onClick={() => onMediaTypeChange('image')}
        >
          图片
        </button>
        <button
          className={generationMediaType === 'video' ? 'mode-chip active' : 'mode-chip'}
          type="button"
          onClick={() => onMediaTypeChange('video')}
        >
          视频
        </button>
      </div>
      <textarea
        id="prompt"
        className="text-input prompt-input"
        placeholder="例如：环保主题海报，黑白摄影 + 粗体标题"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
      />
      <div className="compact-actions">
        <button className="ghost-btn ghost-btn-dark" type="button" onClick={onStartGeneration}>
          {generationButtonLabel}
        </button>
        <button className="ghost-btn" type="button" onClick={onImportReference}>
          导入参考图
        </button>
      </div>
      <input
        ref={fileInputRef}
        hidden
        accept="image/*"
        type="file"
        onChange={(event) => {
          onUpload(event.target.files);
          event.currentTarget.value = '';
        }}
      />
      {jobs.length > 0 ? (
        <div className="job-strip">
          {jobs.slice(0, 2).map((job) => (
            <div key={job.id} className={`mini-pill mini-pill-${job.status}`}>
              <strong>{job.status === 'success' ? '已生成' : job.status === 'failed' ? '失败' : '处理中'}</strong>
              <span>
                {job.mediaType === 'video' ? '视频' : '图片'} · {job.prompt.slice(0, 16)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
