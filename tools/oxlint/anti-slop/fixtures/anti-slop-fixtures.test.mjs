import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(directory, "..", "..", "..", "..");
const runOxlint = (filename) =>
  spawnSync(
    process.execPath,
    [
      join(repositoryRoot, "node_modules", "oxlint", "bin", "oxlint"),
      "--no-ignore",
      "--config",
      join(repositoryRoot, "oxlint.config.ts"),
      filename,
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );

const accepted = runOxlint(join(directory, "accepted.ts"));
if (accepted.status !== 0) {
  throw new Error(
    `Accepted anti-slop fixture failed linting:\n${accepted.stdout}\n${accepted.stderr}`,
  );
}

const owner = runOxlint(join(directory, "ssr-helpers.ts"));
if (owner.status !== 0) {
  throw new Error(
    `Runtime owner fixture failed linting:\n${owner.stdout}\n${owner.stderr}`,
  );
}

const rejected = runOxlint(join(directory, "rejected.ts"));
if (rejected.status === 0) {
  throw new Error("Rejected anti-slop fixture unexpectedly passed linting.");
}

console.log("Oxlint anti-slop fixtures passed.");
