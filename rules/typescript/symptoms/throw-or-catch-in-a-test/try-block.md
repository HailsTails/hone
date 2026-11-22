# try-block

```json
{
  "misses": "`catch`.",
  "settingsTracedTo": "none."
}
```

`try` statements in a test file. These run with the other [test-body checks](../../../README.md#checks-the-test-body-checks), which share their scope, editions and settings.

## Flags
Edition 1:
- `try` statements.

## Allowed forms in a test

### A try block
```ts
declare const load: (path: string) => string;
try {
  load("missing.json");
} catch (error) {
  expect(error).toBeInstanceOf(Error);
}
```
Assert the throw:

```ts
declare const load: (path: string) => string;
expect(() => load("missing.json")).toThrow(Error);
```

```ts
declare const loadLater: (path: string) => Promise<string>;
it("refuses a missing file", async () => {
  await expect(loadLater("missing.json")).rejects.toThrow(Error);
});
```
