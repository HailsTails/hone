# git-spawn-environment

```json
{
  "misses": "`env` built from `process.env` under an accepted name.",
  "settingsTracedTo": "accepted helper names and test-file suffixes: **nothing**."
}
```

A git spawn in a test without a hermetic `env`.

## Flags

- TypeScript `.test` and `.spec` files with `.ts`, `.tsx`, `.mts` or `.cts` extensions, plus `*.test.js`, `*.test.mjs` and `*.spec.mjs`. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped. Use `exclude` in `hone.config.json` to omit other folders.
- A line calling `spawnSync`, `spawn`, `execFileSync`, `execFile`, `execSync`, `exec`, `execa` or `execaSync` with `"git"` (or `'git'`, or a template literal) as the first argument.
- Allowed when, within that line and the next seven, an `env:` names `hermeticGitEnvironment`, `withoutInheritedGitBindings` or `environment`, and no nearby `env:` uses `process.env`. The environment comes from a unit of ours with its own test, not a test helper.
- Not detected: a command string such as `execSync("git status")`, a split call, or a non-literal command. Whether the spawn is warranted at all is left to review.

## Example

```ts
spawnSync("git", ["init"], { cwd: directory });
```

## Fix

```ts
spawnSync("git", ["init"], { cwd: directory, env: hermeticGitEnvironment() });
```
Build the environment without inherited git variables or the user's configuration, and run in a temporary directory.
