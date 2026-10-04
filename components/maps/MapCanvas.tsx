import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { MapCanvasHandle, MapCanvasProps } from './MapCanvas.types';

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas({ html, onEvent }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  useImperativeHandle(ref, () => ({ send: command => frame.current?.contentWindow?.postMessage({ ...command, channel: 'gigzy-map-command' }, '*') }), []);
  useEffect(() => {
    const receive = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow) onEvent(event.data); };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onEvent]);
  return <iframe ref={frame} srcDoc={html} title="Gig locations map" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" style={{ flex: 1, width: '100%', height: '100%', border: 0 }} />;
});
export default MapCanvas;
