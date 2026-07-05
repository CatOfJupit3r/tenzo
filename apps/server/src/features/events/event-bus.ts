import { EventEmitter } from 'node:events';
import { singleton } from 'tsyringe';

import type { Listener } from './listener.class';

type SyncHandler<T> = (payload: T) => unknown;
type AsyncHandler<T> = (payload: T) => Promise<unknown>;
type Handler<T> = SyncHandler<T> | AsyncHandler<T>;

@singleton()
export class EventBus {
  private readonly emitter = new EventEmitter();

  public on<T>(listener: Listener<T>, handler: Handler<T>) {
    this.emitter.on(listener.name, handler);
    return this;
  }

  public off<T>(listener: Listener<T>, handler: Handler<T>) {
    this.emitter.off(listener.name, handler);
    return this;
  }

  public async emit<T>(listener: Listener<T>, payload: T) {
    const rawListeners = this.emitter.rawListeners(listener.name);

    await Promise.all(
      rawListeners.map(async (rawListener) => {
        try {
          // Check if this is a once wrapper
          const isOnceWrapper = typeof rawListener === 'object' && rawListener !== null && 'listener' in rawListener;

          if (isOnceWrapper) {
            // For once listeners, call the wrapper (which includes removal logic)
            const wrapper = rawListener as { listener: (...args: unknown[]) => unknown };
            await wrapper.listener(payload);
            // The wrapper will handle its own removal
            this.emitter.removeListener(listener.name, rawListener as (...args: unknown[]) => unknown);
          } else {
            // For regular listeners, just call them
            await (rawListener as Handler<T>)(payload);
          }
        } catch (error) {
          console.error(`Error in event handler for ${listener.name}:`, error);
        }
      }),
    );
  }

  public once<T>(listener: Listener<T>, handler: Handler<T>) {
    this.emitter.once(listener.name, handler);
    return this;
  }
}
