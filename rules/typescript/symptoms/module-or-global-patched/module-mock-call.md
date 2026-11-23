# module-mock-call

```json
{
  "misses": "Both editions miss aliased receivers and module mocks such as vi.doMock or vi[\"mock\"]. Edition 1 leaves global patches to review. Edition 2 still misses indirect writes and global vi.spyOn calls.",
  "settingsTracedTo": "test file is `.test.ts(x)`: Companion test file recipe."
}
```

Calls to `vi.mock`. Edition 2 also flags `vi.stubGlobal`, `vi.stubEnv` and direct changes to `process.env` in test files, including assignments, deletes, increments and decrements.

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
