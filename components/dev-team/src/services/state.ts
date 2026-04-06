import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DepartmentState, createInitialState } from "../schemas/state.js";

/**
 * File-based state persistence for the dev_team department.
 *
 * State is stored as a single JSON file at a well-known path relative
 * to the department component root. This keeps the state durable and
 * inspectable without requiring a database for bootstrap.
 */

const STATE_FILENAME = "dev-team-state.json";

let stateDir: string | null = null;

/**
 * Set the directory where department state is persisted.
 * Must be called before any read/write operations.
 */
export function setStateDir(dir: string): void {
  stateDir = dir;
}

function getStatePath(): string {
  if (!stateDir) {
    throw new Error(
      "State directory not configured. Call setStateDir() before state operations."
    );
  }
  return path.join(stateDir, STATE_FILENAME);
}

/**
 * Load the current department state from disk.
 * Returns a fresh initial state if no state file exists.
 */
export async function loadState(): Promise<DepartmentState> {
  const statePath = getStatePath();
  try {
    const raw = await fs.readFile(statePath, "utf-8");
    return DepartmentState.parse(JSON.parse(raw));
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return createInitialState();
    }
    throw err;
  }
}

/**
 * Persist the department state to disk.
 */
export async function saveState(state: DepartmentState): Promise<void> {
  const statePath = getStatePath();
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const validated = DepartmentState.parse(state);
  await fs.writeFile(statePath, JSON.stringify(validated, null, 2) + "\n", "utf-8");
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
