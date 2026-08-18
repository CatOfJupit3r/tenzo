import { z } from "zod";

import { isOnClient } from "./ssr-helpers";

const characterShape = z.object({ name: z.string() }).shape;
type CropperShape = { width: number; height: number };
const cropperShape: CropperShape = { width: 1, height: 1 };
const labels = ["character"] as const;

export const acceptedShape = {
  characterShape,
  cropperShape,
  isOnClient,
  labels,
};
