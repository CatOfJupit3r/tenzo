import { readdir, rm } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const workspaceRoots = ["apps", "packages"] as const;

const envFlag = process.env.CLEAR_LOCKFILE?.toLowerCase();
const envWantsLockfileClear = envFlag === "1" || envFlag === "true" || envFlag === "yes";
const shouldClearLockfile = process.argv.includes("--lockfile") || envWantsLockfileClear;

async function safeReadDir(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function collectNodeModulesTargets() {
  const targets = [path.join(rootDir, "node_modules")];

  for (const workspace of workspaceRoots) {
    const workspacePath = path.join(rootDir, workspace);
    const entries = await safeReadDir(workspacePath);

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      targets.push(path.join(workspacePath, entry.name, "node_modules"));
    }
  }

  return targets;
}

async function removeDirectory(target: string) {
  await rm(target, { recursive: true, force: true });
  console.log(`Removed ${path.relative(rootDir, target) || target}`);
}

async function main() {
  const targets = await collectNodeModulesTargets();

  await Promise.all(targets.map(removeDirectory));

  if (shouldClearLockfile) {
    await rm(path.join(rootDir, "pnpm-lock.yaml"), { force: true });
    console.log("Removed pnpm-lock.yaml");
  }
}

main().catch((error) => {
  console.error("Failed to clean workspace:", error);
  process.exit(1);
});
