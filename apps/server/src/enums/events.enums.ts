import z from 'zod';

const EventsSchema = z.enum(['BETA_EVENT']);

export const EVENTS = EventsSchema.enum;

export type EventType = z.infer<typeof EventsSchema>;

export interface iBetaEventPayload {
  userId: string;
}

export interface iEventPayloadMap {
  [EVENTS.BETA_EVENT]: iBetaEventPayload;
}
