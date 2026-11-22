# test-body

```json
{
  "misses": "a local `let` in production.",
  "settingsTracedTo": "none."
}
```

`let` declarations in a test file. These run with the other [test-body checks](../../../README.md#checks-the-test-body-checks), which share their scope, editions and settings.

## Flags
Edition 1:
- `let` declarations.

## Allowed forms in a test

### A let
```ts
declare const record: (store: { readonly save: (text: string) => void }) => void;
let saved = "";
record({ save: (text) => { saved = text; } });
expect(saved).toBe("a");
```
Record the calls with `vi.fn` and assert them:

```ts
declare const record: (store: { readonly save: (text: string) => void }) => void;
const save = vi.fn<(text: string) => void>();
record({ save });
expect(save).toHaveBeenCalledWith("a");
```
