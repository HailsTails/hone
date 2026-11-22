# naming-convention

```json
{
  "settingsTracedTo": "Hone's own casing option lists: **nothing**; casing is the adopter's own lint."
}
```

A name that breaks the naming convention for its kind.

## Flags
Needs ESLint adopted through the projection.
- Under ESLint, this is typescript-eslint's `naming-convention` with the option list in the piece's `piece.json`.
- Enum members are CONSTANT_CASE. `const` bindings are CONSTANT_CASE, camelCase or PascalCase.
- Object literal properties are camelCase. Type properties are camelCase or PascalCase.
- Other variables, functions and parameters are camelCase or PascalCase; a leading or trailing `_` or `$` is allowed.
- Types are PascalCase. Class members are camelCase, and static ones may also be CONSTANT_CASE.
- Consecutive capitals are allowed (`agentID`, `HTTPServer`).
- Ignored: names that need quotes, destructured bindings, imports and unused bindings whose name starts with `_`.
- Not checked, unlike Biome: the local name of a renamed named import (`import { a as b }`) and a `catch` parameter. typescript-eslint has no selector for either; review covers them.
