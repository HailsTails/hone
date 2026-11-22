# static-members-only

```json
{}
```

A class whose members are all static.

- **Misses:** `this` outside a class.
- **Settings traced to:** none.

## Flags
- TypeScript source files; declaration files (`.d.ts`) are skipped. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped by the audit mechanism. The ESLint piece lints whatever files the team's ESLint run includes.

Needs ESLint adopted through the projection.
- Under ESLint, this is typescript-eslint's `no-extraneous-class` with `allowConstructorOnly: true`, `allowEmpty: true`, `allowStaticOnly: false` and `allowWithDecorator: true`.
- It flags a class whose members are all static.
- Allowed: empty classes, decorated classes and classes that extend another class.
