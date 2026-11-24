# Failure asserted as a value

```json
{
  "serves": {
    "rule": "straight-through-tests"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"more error throwing, not allowed\". A `try` or `catch` in a test is a branch that decides whether the test passes.",
    "standing": "proposed"
  },
  "examples": [
    {
      "anchor": "a-try-block",
      "answers": [
        {
          "check": "throw-or-catch-in-a-test#try-block",
          "form": "a-try-block"
        }
      ]
    }
  ]
}
```

- **Method:** A failure is checked as the returned variant: `expect(result).toEqual({ outcome: "failure", ... })`. An adapter whose caller's contract is a throw is checked with `expect(call).toThrow(...)`.
- **You can tell because:** No `try`, `catch` or `throw` in any test.
- **Industry name:** none; it follows from Failures are values.

## Examples

### A try block
```ts
declare const load: (path: string) => string;
try {
  load("missing.json");
} catch (error) {
  expect(error).toBeInstanceOf(Error);
}
```

Assert the returned variant:

```ts
declare const load: (path: string) => { readonly outcome: "ok"; readonly value: string } | { readonly outcome: "failure"; readonly kind: "missing" };
expect(load("missing.json")).toEqual({ outcome: "failure", kind: "missing" });
```

For an adapter whose caller's contract is a throw, assert the throw:

```ts
declare const load: (path: string) => string;
const call = () => load("missing.json");
expect(call).toThrow(Error);
```
