import type { ReactElement } from 'react';

export type AppIconName =
  | 'add'
  | 'aiBrush'
  | 'asset'
  | 'chat'
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'
  | 'connector'
  | 'download'
  | 'frame'
  | 'grid'
  | 'hand'
  | 'history'
  | 'image'
  | 'panel'
  | 'pen'
  | 'redo'
  | 'rect'
  | 'select'
  | 'spark'
  | 'text'
  | 'undo'
  | 'user';

interface AppIconProps {
  name: AppIconName;
  decorative?: boolean;
}

const paths: Record<AppIconName, ReactElement> = {
  add: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  aiBrush: (
    <>
      <path d="M7.5 16.5c-1.2 1.2-1.9 2.1-2.2 3.2 1.1-.2 2.1-.9 3.2-2.1" />
      <path d="M8.4 15.7 15.8 8.3c.7-.7 1.8-.7 2.5 0l.4.4c.7.7.7 1.8 0 2.5l-7.4 7.4c-.8.8-2.1.8-2.9 0s-.8-2.1 0-2.9Z" />
      <path className="icon-accent" d="M17.5 3.8v3.1" />
      <path className="icon-accent" d="M16 5.4h3.1" />
    </>
  ),
  asset: (
    <>
      <path d="M5 6.5h14v11H5z" />
      <path d="m6.7 15 3.2-3.1 2.4 2.3 2.2-2 2.8 2.8" />
      <path d="M9 9.3h.1" />
    </>
  ),
  chat: (
    <>
      <path d="M5 6.5h14v9.8H9.6L5 19.2Z" />
      <path className="icon-accent" d="M12 9.2v4.2" />
      <path className="icon-accent" d="M9.9 11.3h4.2" />
    </>
  ),
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  close: (
    <>
      <path d="m7 7 10 10" />
      <path d="m17 7-10 10" />
    </>
  ),
  connector: (
    <>
      <path d="M7 17.2c2.4-5.5 7.5-5.4 10-10.4" />
      <path d="M5 15.8h4v4H5z" />
      <path d="M15 4.5h4v4h-4z" />
    </>
  ),
  download: (
    <>
      <path d="M12 4.5v10" />
      <path d="m8.2 11 3.8 3.8 3.8-3.8" />
      <path d="M5.5 18.5h13" />
    </>
  ),
  frame: (
    <>
      <path d="M6 6h12v12H6z" />
      <path d="M6 10h12" />
      <path d="M10 6v12" />
    </>
  ),
  grid: (
    <>
      <path d="M5.8 5.8h12.4v12.4H5.8z" />
      <path d="M12 5.8v12.4" />
      <path d="M5.8 12h12.4" />
    </>
  ),
  hand: (
    <>
      <path d="M8.2 11V6.9a1.2 1.2 0 0 1 2.4 0v3.5" />
      <path d="M10.6 10V5.8a1.2 1.2 0 0 1 2.4 0v4.6" />
      <path d="M13 10.5V7a1.2 1.2 0 0 1 2.4 0v5.5" />
      <path d="M15.4 12.2v-2a1.2 1.2 0 0 1 2.4 0v3.9c0 3.3-2.2 5.4-5.4 5.4h-1.5c-1.9 0-3.1-.8-4.1-2.4l-2-3.3a1.35 1.35 0 0 1 2.2-1.5l1.2 1.5" />
    </>
  ),
  history: (
    <>
      <path d="M10 7.2a5 5 0 1 1-3.7 8.4" />
      <path d="M5 7.3v4h4" />
      <path d="M12 9.4V13l2.5 1.5" />
      <path d="M18 8h1.8" />
      <path d="M18 12h1.8" />
      <path d="M18 16h1.8" />
    </>
  ),
  image: (
    <>
      <path d="M5.5 6.5h13v11h-13z" />
      <path d="m7.2 15.2 3.2-3 2.4 2.3 2.2-2.1 2.6 2.8" />
      <path d="M9.2 9.2h.1" />
    </>
  ),
  panel: (
    <>
      <path d="M5 6h14v12H5z" />
      <path d="M10 6v12" />
      <path d="M7 10h1" />
    </>
  ),
  pen: (
    <>
      <path d="m5 18.7 3.2-.8 9.2-9.2a1.7 1.7 0 0 0 0-2.4l-.7-.7a1.7 1.7 0 0 0-2.4 0L5.1 14.8Z" />
      <path d="m13.4 6.4 4.2 4.2" />
    </>
  ),
  redo: (
    <>
      <path d="M8 7h6.2a4.8 4.8 0 1 1 0 9.6H7.5" />
      <path d="m14.2 4.5 3 2.5-3 2.5" />
    </>
  ),
  rect: <path d="M6.5 6.5h11v11h-11z" />,
  select: (
    <>
      <path d="M6.5 5.8 17.8 12 13 13.2l-1.2 4.8Z" />
      <path d="m13.1 13.1 4.1 4.1" />
    </>
  ),
  spark: (
    <>
      <path className="icon-accent" d="m12 4 1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5Z" />
      <path d="m6.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
    </>
  ),
  text: (
    <>
      <path d="M6 6.5h12" />
      <path d="M12 6.5v11" />
      <path d="M9.2 17.5h5.6" />
      <path d="M6 6.5v2.2" />
      <path d="M18 6.5v2.2" />
    </>
  ),
  undo: (
    <>
      <path d="M16 7H9.8a4.8 4.8 0 1 0 0 9.6h6.7" />
      <path d="m9.8 4.5-3 2.5 3 2.5" />
    </>
  ),
  user: (
    <>
      <path d="M12 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M5.8 19c1.2-2.5 3.3-3.8 6.2-3.8s5 1.3 6.2 3.8" />
    </>
  ),
};

export function AppIcon({ name, decorative = true }: AppIconProps) {
  return (
    <svg
      className="app-icon"
      viewBox="0 0 24 24"
      aria-hidden={decorative ? 'true' : undefined}
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <defs>
        <linearGradient id="icon-accent-gradient" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="0.55" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      {paths[name]}
    </svg>
  );
}
