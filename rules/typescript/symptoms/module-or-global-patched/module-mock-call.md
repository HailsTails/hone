# module-mock-call

```json
{}
```

Calls to `vi.mock`.

- **Misses:** `vi.stubGlobal`, `process.env` set in a test.
- **Settings traced to:** test file is `.test.ts(x)`: Companion test file recipe.

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
