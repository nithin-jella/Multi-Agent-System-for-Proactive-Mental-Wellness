/**
 * EventBridge - Singleton for Phaser ↔ React communication
 * 
 * Usage in Phaser:
 *   const bridge = EventBridge.getInstance();
 *   bridge.emit('combat:victory', { rewards });
 * 
 * Usage in React:
 *   const bridge = EventBridge.getInstance();
 *   bridge.on('combat:victory', (data) => { ... });
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventCallback = (data: any) => void;

export class EventBridge {
  private static instance: EventBridge;
  private listeners: Map<string, EventCallback[]> = new Map();

  private constructor() {
    console.log('[EventBridge] Initialized');
  }

  static getInstance(): EventBridge {
    if (!EventBridge.instance) {
      EventBridge.instance = new EventBridge();
    }
    return EventBridge.instance;
  }

  /**
   * Register an event listener
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    console.log(`[EventBridge] Registered listener for "${event}"`);
  }

  /**
   * Emit an event with data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string, data: any): void {
    console.log(`[EventBridge] Emitting "${event}"`, data);
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventBridge] Error in listener for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Remove an event listener
   */
  off(event: string, callback: EventCallback): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
        console.log(`[EventBridge] Removed listener for "${event}"`);
      }
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      console.log(`[EventBridge] Removed all listeners for "${event}"`);
    } else {
      this.listeners.clear();
      console.log('[EventBridge] Removed all listeners');
    }
  }
}
