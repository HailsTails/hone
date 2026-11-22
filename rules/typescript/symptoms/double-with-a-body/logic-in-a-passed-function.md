# logic-in-a-passed-function

```json
{
  "misses": "hand-written doubles.",
  "settingsTracedTo": "test file is `.test.ts(x)`: Companion test file recipe."
}
```

A construct any other test-body check flags, inside a function a test passes on. These run with the other [test-body checks](../../../README.md#checks-the-test-body-checks), which share their scope, editions and settings.

## Flags
- A function a test writes as a property or method of an object literal, or gives to `vi.fn` or `mockImplementation`, holding a construct another test-body check flags at the edition that runs.

## Allowed forms in a test

### Logic inside a function the test passes on
```ts
declare const isInstalled: (fileKind: { readonly kindOf: (path: string) => "file" | "missing" }) => "installed" | "missing";
const installedFiles = ["bin/hone.js"];
expect(isInstalled({ kindOf: (path) => (installedFiles.includes(path) ? "file" : "missing") })).toBe("installed");
```
A function a test writes as a property or method of an object literal, or gives to `vi.fn` or `mockImplementation`, is passed on: to the unit, to a table row, or to a double. Any flagged construct inside it names this section. Make it a `vi.fn` spy with a written-out return, and write out what it was asked:

```ts
declare const isInstalled: (fileKind: { readonly kindOf: (path: string) => "file" | "missing" }) => "installed" | "missing";
const kindOf = vi.fn<(path: string) => "file" | "missing">().mockReturnValue("file");
expect(isInstalled({ kindOf })).toBe("installed");
expect(kindOf).toHaveBeenCalledExactlyOnceWith("bin/hone.js");
```

The recipe is [Stub with vi.fn](../../recipes/stub-with-vifn.md).
