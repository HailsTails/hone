# companion-test-file

```json
{}
```

A production file with a runtime export and no `.test` sibling.

- **Misses:** an empty or non-running sibling.
- **Settings traced to:** `__tests__` skipped by default, on purpose (noise; the practice is not adopted). `exclude` is scope.

## Flags

- Production `.ts` and `.tsx` files. Skipped: `*.test.ts(x)`, `.d.ts` and anything under `__tests__`. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped; any other folder or file can be left out with `exclude` in disciplines.json.
- A file with a runtime export (`export const`, `function`, `class`, `enum`, `export default`, or `export { name }`) and no `<name>.test.ts` beside it (`<name>.test.tsx` for `.tsx`). The sibling must be in the repository's file list.
- Allowed: files with only `export type`, `export interface`, `export declare`, type-only named exports or `export * from`, and files with no exports.
- The source rule asks for a test beside every source file; files without runtime exports are left to review.

## Example

```ts
export const price = 1;
```
This is `src/price.ts` with no `src/price.test.ts` beside it.

## Fix

Add `src/price.test.ts` next to the file, with at least one test of its behaviour.
