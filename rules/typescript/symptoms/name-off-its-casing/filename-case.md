# filename-case

```json
{
  "settingsTracedTo": "Hone's own casing option lists: **nothing**; casing is the adopter's own lint."
}
```

A file name that is not kebab-case or PascalCase.

## Flags
Needs ESLint adopted through the projection.
- Under ESLint, the file name before its first dot is checked, after trimming edge `_`: it must be kebab-case or PascalCase. Each later dot segment must be kebab-case, PascalCase or lowercase.
- One leading `.`, `+` or `$` is ignored.
- Route names such as `[slug].ts` and `(group).ts` pass.
- A bad name is reported at line 1.
