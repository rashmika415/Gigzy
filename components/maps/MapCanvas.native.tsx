import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import type { MapCanvasHandle, MapCanvasProps } from './MapCanvas.types';
import { colors } from '../../constants/theme';

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas({ html, onEvent }, ref) {
  const webview = useRef<WebView>(null);
  useImperativeHandle(ref, () => ({ send: command => webview.current?.injectJavaScript(`window.localworksCommand && window.localworksCommand(${JSON.stringify(command)});true;`) }), []);
  return <WebView ref={webview} source={{ html }} style={{ flex: 1, backgroundColor: colors.background }} originWhitelist={['*']}
    javaScriptEnabled mixedContentMode="never" setSupportMultipleWindows={false}
    onMessage={event => { try { onEvent(JSON.parse(event.nativeEvent.data)); } catch { /* Ignore malformed messages. */ } }}
    onError={() => onEvent({ channel: 'localworks-map', type: 'error' })}
    onShouldStartLoadWithRequest={request => {
      if (request.url === 'about:blank' || request.url.startsWith('about:blank#')) return true;
      if (/^https:\/\/(www\.geoapify\.com|www\.openstreetmap\.org)\//.test(request.url)) void Linking.openURL(request.url).catch(() => {});
      return false;
    }} />;
});
export default MapCanvas;
