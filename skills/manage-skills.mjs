#!/usr/bin/env node

import { cp, mkdir, readdir, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const MARKER_NAME = ".adf-skill-install.json";
const ROOT_MARKER_NAME = ".adf-skills-install.json";
const TARGETS = new Set(["codex", "claude", "gemini"]);

const scriptPath = fileURLToPath(import.meta.url);
const skillsRoot = dirname(scriptPath);
const defaultProjectRoot = resolve(skillsRoot, "..");

main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.stack ?? error.message : String(error)) + "\n");
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0] ?? "status";
  if (!["install", "check", "status"].includes(command)) {
    fail("Unknown command '" + command + "'. Use install, check, or status.");
  }

  const projectRoot = resolve(args.values["project-root"] ?? defaultProjectRoot);
  const manifest = await loadManifest();
  const targets = resolveTargets(args.values.target ?? "codex");
  if (targets.length > 1 && args.values["install-root"]) {
    fail("--install-root may be used only with a single target.");
  }

  const results = [];
  let failed = false;

  for (const target of targets) {
    const targetRoot = resolveTargetRoot(target, projectRoot, args.values["install-root"]);
    const result = command === "install"
      ? await installTarget({ manifest, projectRoot, target, targetRoot })
      : await checkTarget({ manifest, projectRoot, target, targetRoot });

    if (command === "status") {
      result.command = "status";
    }
    results.push(result);
    if (result.errors.length > 0) {
      failed = true;
    }
  }

  printJson({
    command,
    project_root: normalizeSlashes(projectRoot),
    skills_root: normalizeSlashes(skillsRoot),
    results
  });

  if ((command === "check" || command === "install") && failed) {
    process.exit(1);
  }
}

async function loadManifest() {
  const manifestPath = join(skillsRoot, "manifest.json");
  const raw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  if (!Array.isArray(manifest.shared_files) || !Array.isArray(manifest.skills)) {
    fail("manifest.json must contain shared_files and skills arrays.");
  }

  return {
    path: manifestPath,
    data: manifest
  };
}

function resolveTargets(value) {
  if (value === "all") {
    return Array.from(TARGETS);
  }

  const targets = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (targets.length === 0) {
    fail("At least one target is required.");
  }

  for (const target of targets) {
    if (!TARGETS.has(target)) {
      fail("Unsupported target '" + target + "'. Allowed targets: " + Array.from(TARGETS).join(", ") + ", all.");
    }
  }

  return targets;
}

function resolveTargetRoot(target, projectRoot, explicitInstallRoot) {
  if (explicitInstallRoot) {
    return resolve(explicitInstallRoot);
  }

  if (target === "codex") {
    const codexHome = process.env.CODEX_HOME
      ? resolve(process.env.CODEX_HOME)
      : join(homedir(), ".codex");
    return join(codexHome, "skills");
  }

  if (target === "claude") {
    return process.env.CLAUDE_SKILLS_ROOT
      ? resolve(process.env.CLAUDE_SKILLS_ROOT)
      : join(homedir(), ".claude", "skills");
  }

  if (target === "gemini") {
    return process.env.GEMINI_SKILLS_ROOT
      ? resolve(process.env.GEMINI_SKILLS_ROOT)
      : join(homedir(), ".gemini", "skills");
  }

  fail("Unsupported target '" + target + "'.");
}

function resolveInstallMode(target) {
  if (target === "codex") {
    return "pointer";
  }
  return "copy";
}

async function installTarget(input) {
  const { manifest, projectRoot, target, targetRoot } = input;
  const installMode = resolveInstallMode(target);
  const copiedSkills = [];
  const removedLegacyEntries = [];
  const errors = [];
  const warnings = [];

  await mkdir(targetRoot, { recursive: true });

  if (installMode === "copy") {
    for (const sharedFile of manifest.data.shared_files) {
      const sourcePath = join(skillsRoot, sharedFile);
      const targetPath = join(targetRoot, sharedFile);
      await ensureExists(sourcePath, "Missing shared source file '" + sourcePath + "'.");
      await cp(sourcePath, targetPath, { force: true });
    }
  }

  for (const skill of manifest.data.skills) {
    const sourceDir = join(skillsRoot, skill.name);
    const targetDir = join(targetRoot, skill.name);

    try {
      await validateSkillSource(sourceDir, skill);
      await rm(targetDir, { recursive: true, force: true });
      if (installMode === "pointer") {
        await createDirectoryPointer(sourceDir, targetDir);
      } else {
        await cp(sourceDir, targetDir, { recursive: true, force: true });
        await writeJson(join(targetDir, MARKER_NAME), {
          target,
          installed_at: new Date().toISOString(),
          project_root: normalizeSlashes(projectRoot),
          source_dir: normalizeSlashes(sourceDir),
          target_dir: normalizeSlashes(targetDir),
          manifest_version: manifest.data.version,
          install_mode: installMode
        });
      }
      copiedSkills.push({
        skill: skill.name,
        source_dir: normalizeSlashes(sourceDir),
        target_dir: normalizeSlashes(targetDir),
        install_mode: installMode
      });
    } catch (error) {
      errors.push("Failed to install '" + skill.name + "': " + describeError(error));
    }

    for (const legacyName of skill.legacy_public_names ?? []) {
      const legacyPath = join(targetRoot, legacyName);
      if (await pathExists(legacyPath)) {
        await rm(legacyPath, { recursive: true, force: true });
        removedLegacyEntries.push(normalizeSlashes(legacyPath));
      }
    }
  }

  await writeJson(join(targetRoot, ROOT_MARKER_NAME), {
    target,
    install_mode: installMode,
    installed_at: new Date().toISOString(),
    project_root: normalizeSlashes(projectRoot),
    skills_root: normalizeSlashes(skillsRoot),
    manifest_version: manifest.data.version
  });

  const checkResult = await checkTarget({ manifest, projectRoot, target, targetRoot });
  warnings.push(...checkResult.warnings);
  errors.push(...checkResult.errors);

  return {
    command: "install",
    target,
    target_root: normalizeSlashes(targetRoot),
    copied_skills: copiedSkills,
    removed_legacy_entries: removedLegacyEntries,
    warnings,
    errors
  };
}

async function checkTarget(input) {
  const { manifest, projectRoot, target, targetRoot } = input;
  const installMode = resolveInstallMode(target);
  const warnings = [];
  const errors = [];
  const checkedSkills = [];

  if (!(await pathExists(targetRoot))) {
    errors.push("Target root does not exist: " + normalizeSlashes(targetRoot));
    return {
      command: "check",
      target,
      target_root: normalizeSlashes(targetRoot),
      checked_skills: checkedSkills,
      warnings,
      errors
    };
  }

  if (installMode === "copy") {
    for (const sharedFile of manifest.data.shared_files) {
      const sourcePath = join(skillsRoot, sharedFile);
      const targetPath = join(targetRoot, sharedFile);
      if (!(await pathExists(targetPath))) {
        errors.push("Missing shared installed file: " + normalizeSlashes(targetPath));
        continue;
      }
      if (!(await sameFileContents(sourcePath, targetPath))) {
        errors.push("Shared file content mismatch: " + normalizeSlashes(targetPath));
      }
    }
  }

  for (const skill of manifest.data.skills) {
    const sourceDir = join(skillsRoot, skill.name);
    const targetDir = join(targetRoot, skill.name);
    const skillErrors = [];

    try {
      await validateSkillSource(sourceDir, skill);
      if (!(await pathExists(targetDir))) {
        skillErrors.push("Missing installed skill directory.");
      } else {
        if (installMode === "pointer") {
          const [sourceRealPath, targetRealPath] = await Promise.all([
            realpath(sourceDir),
            realpath(targetDir)
          ]);
          if (normalizeSlashes(sourceRealPath) !== normalizeSlashes(targetRealPath)) {
            skillErrors.push("Installed skill directory is not a pointer to the repo skill source.");
          }
        } else {
          const compare = await compareDirectories(sourceDir, targetDir, new Set([MARKER_NAME]));
          skillErrors.push(...compare.errors);

          const markerPath = join(targetDir, MARKER_NAME);
          if (!(await pathExists(markerPath))) {
            warnings.push("Missing install marker for " + normalizeSlashes(targetDir) + ".");
          } else {
            const marker = JSON.parse(await readFile(markerPath, "utf8"));
            if (normalizeSlashes(sourceDir) !== marker.source_dir) {
              warnings.push("Install marker source mismatch for " + normalizeSlashes(targetDir) + ".");
            }
          }
        }
      }
    } catch (error) {
      skillErrors.push(describeError(error));
    }

    for (const legacyName of skill.legacy_public_names ?? []) {
      const legacyPath = join(targetRoot, legacyName);
      if (await pathExists(legacyPath)) {
        skillErrors.push("Legacy setup entry should be absent: " + normalizeSlashes(legacyPath));
      }
    }

    checkedSkills.push({
      skill: skill.name,
      source_dir: normalizeSlashes(sourceDir),
      target_dir: normalizeSlashes(targetDir),
      errors: skillErrors
    });
    errors.push(...skillErrors.map((message) => skill.name + ": " + message));
  }

  return {
    command: "check",
    target,
    target_root: normalizeSlashes(targetRoot),
    checked_skills: checkedSkills,
    warnings,
    errors
  };
}

async function validateSkillSource(sourceDir, skill) {
  if (!(await pathExists(sourceDir))) {
    fail("Missing skill source directory: " + normalizeSlashes(sourceDir));
  }
  for (const requiredFile of skill.required_files ?? []) {
    const targetPath = join(sourceDir, requiredFile);
    await ensureExists(targetPath, "Missing required source file '" + normalizeSlashes(targetPath) + "'.");
  }
}

async function createDirectoryPointer(sourceDir, targetDir) {
  await mkdir(dirname(targetDir), { recursive: true });
  await symlink(sourceDir, targetDir, process.platform === "win32" ? "junction" : "dir");
}

async function compareDirectories(sourceDir, targetDir, ignoredNames) {
  const sourceFiles = await listFiles(sourceDir, ignoredNames);
  const targetFiles = await listFiles(targetDir, ignoredNames);
  const errors = [];

  const sourceRelative = new Set(sourceFiles.map((entry) => entry.relative_path));
  const targetRelative = new Set(targetFiles.map((entry) => entry.relative_path));

  for (const relativePath of sourceRelative) {
    if (!targetRelative.has(relativePath)) {
      errors.push("Missing installed file '" + relativePath + "'.");
    }
  }

  for (const relativePath of targetRelative) {
    if (!sourceRelative.has(relativePath)) {
      errors.push("Unexpected installed file '" + relativePath + "'.");
    }
  }

  const commonPaths = Array.from(sourceRelative).filter((relativePath) => targetRelative.has(relativePath));
  for (const relativePath of commonPaths) {
    const sourcePath = join(sourceDir, relativePath);
    const targetPath = join(targetDir, relativePath);
    if (!(await sameFileContents(sourcePath, targetPath))) {
      errors.push("Content mismatch for '" + relativePath + "'.");
    }
  }

  return { errors };
}

async function listFiles(rootDir, ignoredNames, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredNames.has(entry.name)) {
      continue;
    }

    const childPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(rootDir, ignoredNames, childPath)));
      continue;
    }

    files.push({
      absolute_path: childPath,
      relative_path: normalizeSlashes(relative(rootDir, childPath))
    });
  }

  return files.sort((left, right) => left.relative_path.localeCompare(right.relative_path));
}

async function sameFileContents(leftPath, rightPath) {
  const left = await readFile(leftPath);
  const right = await readFile(rightPath);
  if (left.length !== right.length) {
    return false;
  }
  return left.equals(right);
}

async function ensureExists(targetPath, message) {
  if (!(await pathExists(targetPath))) {
    fail(message);
  }
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function writeJson(targetPath, value) {
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function parseArgs(argv) {
  const values = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      values[key] = "true";
      continue;
    }
    values[key] = next;
    index += 1;
  }

  return { positionals, values };
}

function normalizeSlashes(value) {
  return String(value).replace(/\\/g, "/");
}

function describeError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function fail(message) {
  process.stderr.write(message + "\n");
  process.exit(1);
}
