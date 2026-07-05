import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { EventBus } from '@~/features/events/event-bus';
import { Listener } from '@~/features/events/listener.class';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  it('should emit events and wait for all handlers to complete', async () => {
    const testListener = new Listener<{ value: number }>('TEST_EVENT');
    const results: number[] = [];

    eventBus.on(testListener, async ({ value }) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      results.push(value * 2);
    });

    eventBus.on(testListener, async ({ value }) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      results.push(value * 3);
    });

    await eventBus.emit(testListener, { value: 5 });

    expect(results).toHaveLength(2);
    expect(results).toContain(10);
    expect(results).toContain(15);
  });

  it('should handle synchronous handlers', async () => {
    const testListener = new Listener<{ value: string }>('SYNC_TEST');
    let result = '';

    eventBus.on(testListener, ({ value }) => {
      result = value.toUpperCase();
    });

    await eventBus.emit(testListener, { value: 'hello' });

    expect(result).toBe('HELLO');
  });

  it('should catch and log errors in handlers without throwing', async () => {
    const testListener = new Listener<{ value: number }>('ERROR_TEST');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const results: number[] = [];

    eventBus.on(testListener, async ({ value }) => {
      throw new Error('Handler error');
    });

    eventBus.on(testListener, async ({ value }) => {
      results.push(value * 2);
    });

    await eventBus.emit(testListener, { value: 5 });

    expect(consoleSpy).toHaveBeenCalled();
    expect(results).toContain(10);

    consoleSpy.mockRestore();
  });

  it('should support once listeners', async () => {
    const testListener = new Listener<{ count: number }>('ONCE_TEST');
    let callCount = 0;

    eventBus.once(testListener, async () => {
      callCount++;
    });

    await eventBus.emit(testListener, { count: 1 });
    await eventBus.emit(testListener, { count: 2 });

    expect(callCount).toBe(1);
  });

  it('should support removing listeners', async () => {
    const testListener = new Listener<{ value: number }>('OFF_TEST');
    const results: number[] = [];

    const handler = async ({ value }: { value: number }) => {
      results.push(value);
    };

    eventBus.on(testListener, handler);
    await eventBus.emit(testListener, { value: 1 });

    eventBus.off(testListener, handler);
    await eventBus.emit(testListener, { value: 2 });

    expect(results).toEqual([1]);
  });

  it('should run multiple handlers in parallel', async () => {
    const testListener = new Listener<{ delay: number }>('PARALLEL_TEST');
    const startTime = Date.now();
    const delays: number[] = [];

    eventBus.on(testListener, async ({ delay }) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delays.push(delay);
    });

    eventBus.on(testListener, async ({ delay }) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delays.push(delay * 2);
    });

    await eventBus.emit(testListener, { delay: 50 });
    const elapsed = Date.now() - startTime;

    // Handlers should run in parallel, so total time should be ~50ms, not ~100ms
    expect(elapsed).toBeLessThan(80);
    expect(delays).toHaveLength(2);
  });
});
