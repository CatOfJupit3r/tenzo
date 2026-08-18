import { jsonrepair } from 'jsonrepair';

export class JsonRepairError extends Error {
  public readonly inputLength: number;

  public readonly position: number | undefined;

  public constructor(value: string, cause: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : 'Unknown JSON repair failure.';
    const positionMatch = /position\s+(\d+)/i.exec(causeMessage);
    super(causeMessage, { cause });
    this.name = 'JsonRepairError';
    this.inputLength = value.length;
    this.position = positionMatch?.[1] ? Number(positionMatch[1]) : undefined;
  }
}

export function repairJson(value: string) {
  try {
    return jsonrepair(value);
  } catch (error) {
    throw new JsonRepairError(value, error);
  }
}

export function parseRepairedJson(value: string): unknown {
  return JSON.parse(repairJson(value)) as unknown;
}
