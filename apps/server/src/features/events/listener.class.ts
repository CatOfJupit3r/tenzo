/**
 * A typed event listener that carries both the event name and payload type.
 * Listeners are defined in the events module and imported by other features.
 */
export class Listener<TPayload = never> {
  /** Phantom property to preserve the payload type at compile time */
  declare private readonly _phantom: TPayload;

  constructor(public readonly name: string) {}
}

/** Type helper to extract the payload type from a Listener */
export type ListenerPayload<T> = T extends Listener<infer P> ? P : never;
