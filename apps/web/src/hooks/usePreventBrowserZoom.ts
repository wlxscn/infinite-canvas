import { useEffect } from 'react';

export function usePreventBrowserZoom() {
  useEffect(() => {
    function preventBrowserZoomWithWheel(event: WheelEvent): void {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    }

    function preventBrowserZoomHotkeys(event: KeyboardEvent): void {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
      if (!cmdOrCtrl) {
        return;
      }

      if (event.key === '+' || event.key === '-' || event.key === '=' || event.key === '0') {
        event.preventDefault();
      }
    }

    function preventSafariGestureZoom(event: Event): void {
      event.preventDefault();
    }

    window.addEventListener('wheel', preventBrowserZoomWithWheel, { passive: false });
    window.addEventListener('keydown', preventBrowserZoomHotkeys);
    window.addEventListener('gesturestart', preventSafariGestureZoom, { passive: false });
    window.addEventListener('gesturechange', preventSafariGestureZoom, { passive: false });
    window.addEventListener('gestureend', preventSafariGestureZoom, { passive: false });

    return () => {
      window.removeEventListener('wheel', preventBrowserZoomWithWheel);
      window.removeEventListener('keydown', preventBrowserZoomHotkeys);
      window.removeEventListener('gesturestart', preventSafariGestureZoom);
      window.removeEventListener('gesturechange', preventSafariGestureZoom);
      window.removeEventListener('gestureend', preventSafariGestureZoom);
    };
  }, []);
}
