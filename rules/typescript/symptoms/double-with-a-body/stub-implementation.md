# stub-implementation

```json
{}
```

`vi.fn(<implementation>)` and `.mockImplementation(...)`.

- **Misses:** hand-written doubles.
- **Settings traced to:** test file is `.test.ts(x)`: Companion test file recipe.

## Flags

- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A `vi.fn(...)` call with any argument, and any call to a method named `mockImplementation` (on any receiver, with or without arguments).
- Allowed: `vi.fn()`, `.mockReturnValue(...)`, `.mockResolvedValue(...)`, `.mockReturnValueOnce(...)` and `.mockImplementationOnce(...)`.
- `.mockImplementationOnce(...)` is not flagged even though it takes an implementation; whether that implementation gives the double behaviour is left to review.
- The source rule is wider (no real I/O, no real collaborators). Whether a unit is isolated is left to review.

## Example

```ts
const clock = { now: vi.fn(() => 1) };
```

## Fix

```ts
const clock = { now: vi.fn().mockReturnValue(1) };
```
Return a canned value: that double is a stub. If the double needs logic, the seam is probably too wide.
