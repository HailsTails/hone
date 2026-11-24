# Stub with vi.fn

```json
{
  "serves": [
    {
      "rule": "written-out-answers"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"these should be vi.fn, with mockResolvedValue, not custom async functions\"; \"Agents take fake to mean whatever they want it to mean right now.\" The framework's double has no body of ours to hold logic.",
    "standing": "accepted"
  },
  "examples": [
    {
      "anchor": "an-optional-chain-on-a-mock-call",
      "answers": [
        {
          "check": "branch-in-a-test#test-body",
          "form": "an-optional-chain-on-a-mock-call"
        }
      ]
    },
    {
      "anchor": "an-optional-chain-on-a-mock-result",
      "answers": [
        {
          "check": "branch-in-a-test#test-body",
          "form": "an-optional-chain-on-a-mock-result"
        }
      ]
    },
    {
      "anchor": "logic-inside-a-function-the-test-passes-on",
      "answers": [
        {
          "check": "double-with-a-body#logic-in-a-passed-function",
          "form": "logic-inside-a-function-the-test-passes-on"
        }
      ]
    },
    {
      "anchor": "a-let",
      "answers": [
        {
          "check": "rebinding#test-body",
          "form": "a-let"
        }
      ]
    }
  ]
}
```

- **Method:** Each collaborator is a `vi.fn()` declared as a const inside the test that uses it. Shared boilerplate or a mock builder is allowed where it hides none of three things: a wide interface, an assumption a test rests on, or coupling between tests. A shared double is therefore a symptom, suspect by default, not a breach. Its answer is `mockReturnValue` or `mockResolvedValue` with a written-out value. Each call is checked with `toHaveBeenCalledWith` and a written-out argument.
- **You can tell because:** No double has a body, a branch or a table. Every call the unit makes is asserted.
- **Industry name:** stub and spy; Test Stub (Meszaros, *xUnit Test Patterns*).

A fake is not a recipe. It is a [deviation record](../../record-kinds/deviation.md), and the bar it must meet is: "Moving a fake is only allowed if the test cannot be done with deterministic stubs or hardcoded things."

## Examples

### An optional chain on a mock call
```ts
declare const start: (run: (task: { readonly id: string }) => void) => void;
const run = vi.fn<(task: { readonly id: string }) => void>();
start(run);
expect(run.mock.calls[0]?.[0].id).toBe("a");
```

Check the call, its argument written out:

```ts
declare const start: (run: (task: { readonly id: string }) => void) => void;
const run = vi.fn<(task: { readonly id: string }) => void>();
start(run);
expect(run).toHaveBeenCalledWith({ id: "a" });
```

### An optional chain on a mock result
```ts
declare const pricing: { readonly priceOf: (amount: number) => number };
declare const settle: (order: { readonly amount: number; readonly priceOf: (amount: number) => number }) => number;
const priceOf = vi.spyOn(pricing, "priceOf");
settle({ amount: 2, priceOf: pricing.priceOf });
expect(priceOf.mock.results[0]?.value).toBe(4);
```

Write out what the collaborator gives back, then check what the unit returns and the call it makes:

```ts
declare const settle: (order: { readonly amount: number; readonly priceOf: (amount: number) => number }) => number;
const priceOf = vi.fn<(amount: number) => number>().mockReturnValue(4);
expect(settle({ amount: 2, priceOf })).toBe(4);
expect(priceOf).toHaveBeenCalledWith(2);
```

### Logic inside a function the test passes on
```ts
declare const isInstalled: (fileKind: { readonly kindOf: (path: string) => "file" | "missing" }) => "installed" | "missing";
const installedFiles = ["bin/hone.js"];
expect(isInstalled({ kindOf: (path) => (installedFiles.includes(path) ? "file" : "missing") })).toBe("installed");
```

Make it a `vi.fn` with a written-out return, and check the call:

```ts
declare const isInstalled: (fileKind: { readonly kindOf: (path: string) => "file" | "missing" }) => "installed" | "missing";
const kindOf = vi.fn<(path: string) => "file" | "missing">().mockReturnValue("file");
expect(isInstalled({ kindOf })).toBe("installed");
expect(kindOf).toHaveBeenCalledExactlyOnceWith("bin/hone.js");
```

### A let
```ts
declare const record: (store: { readonly save: (text: string) => void }) => void;
let saved = "";
record({ save: (text) => { saved = text; } });
expect(saved).toBe("a");
```

Pass in a `vi.fn`, and check the call:

```ts
declare const record: (store: { readonly save: (text: string) => void }) => void;
const save = vi.fn<(text: string) => void>();
record({ save });
expect(save).toHaveBeenCalledWith("a");
```
