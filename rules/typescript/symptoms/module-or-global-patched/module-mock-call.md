# module-mock-call

```json
{
  "misses": "Aliased receivers and indirect writes.",
  "settingsTracedTo": "test file is `.test.ts(x)`: Companion test file recipe."
}
```

Calls to `vi.mock`. Edition 2 also flags `vi.stubGlobal` and direct writes to `process.env` in test files.

## Flags

- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every call spelled `vi.mock(...)`, with or without arguments.
- Not detected: `vi.doMock`, `jest.mock`, `vitest.mock` and `vi["mock"]`. Those are left to review.

## Example

```ts
vi.mock("./store.ts");
```

## Fix

```ts
const subject = createSubject({ store: storeStub });
```
Pass the collaborator in as a dependency and hand the test a stub.
