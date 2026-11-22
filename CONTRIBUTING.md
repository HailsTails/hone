# Contributing

Hone is maintained by one person in their own time. No response time is promised for issues, pull requests or questions. Open one if it helps you; it may wait.

To report a security problem, follow [SECURITY.md](SECURITY.md). Do not open an issue.

## Set up

Hone uses pnpm through corepack, and Node `22.18.0` or newer.

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

## Check your change

```bash
corepack pnpm run check
corepack pnpm run self-check --base-revision origin/main
```

`check` runs the type check, the oxfmt formatting check and the tests; `format` writes the formatting. `self-check` runs Hone's own disciplines on this repository against the base revision.

If you change how the package is built or what it ships, also run:

```bash
corepack pnpm run build-package
corepack pnpm run package-determinism
corepack pnpm run install-proof
corepack pnpm run pack-package
```

## House rules

- No code comments. Names and types carry the meaning.
- Strict typing. No `any`, and no casts that hide a type error.
- Do not add or change an exemption, a carve-out, an authorised location or an exception record without the owner's agreement. If a check fails, fix the code.
- Write prose in plain English with short sentences.

## Pull requests

Pull requests are squash-merged by title, so the title must be a Conventional Commit, for example `fix: report the right line`. The pull request template says what to include.
