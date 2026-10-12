export interface MapCommand { type: 'fit' | 'locate' | 'set-location' | 'clear-location'; latitude?: number; longitude?: number }
export interface MapCanvasHandle { send: (command: MapCommand) => void }
export interface MapCanvasProps { html: string; onEvent: (event: unknown) => void }
