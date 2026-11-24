# Assert to narrow

```json
{
  "serves": [
    {
      "rule": "straight-through-tests"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"use vi assert to validate it's existence first to narrow the type to exclude the need for optional chain\".",
    "standing": "accepted"
  },
  "examples": [
    {
      "anchor": "a-short-circuit",
      "answers": [
        {
          "check": "branch-in-a-test#test-body",
          "form": "a-short-circuit"
        }
      ]
    },
    {
      "anchor": "an-optional-chain-after-an-index",
      "answers": [
        {
          "check": "branch-in-a-test#test-body",
          "form": "an-optional-chain-after-an-index"
        }
      ]
    },
    {
      "anchor": "an-optional-chain-on-a-property",
      "answers": [
        {
          "check": "branch-in-a-test#test-body",
          "form": "an-optional-chain-on-a-property"
        }
      ]
    },
    {
      "anchor": "an-optional-call",
      "answers": [
        {
          "check": "branch-in-a-test#test-body",
          "form": "an-optional-call"
        }
      ]
    }
  ]
}
```

- **Method:** A value that may be absent or one of several outcomes is narrowed with the framework's `assert` first. After that, plain `expect` reads it.
- **You can tell because:** No `?.`, `&&`, `if` or ternary in the test.
- **Industry name:** Guard Assertion (Meszaros).

## Examples

### A short-circuit
```ts
declare const lookup: (id: string) => { readonly name: string } | undefined;
const found = lookup("a");
expect(found !== undefined && found.name === "Ada").toBe(true);
```

Assert the value is defined, then read it:

```ts
declare const lookup: (id: string) => { readonly name: string } | undefined;
const found = lookup("a");
assert.isDefined(found);
expect(found.name).toBe("Ada");
```

### An optional chain after an index
```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks()[0]?.id).toBe("a");
```

Destructure the element and assert it is defined, then read it:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
const [first] = listTasks();
assert.isDefined(first);
expect(first.id).toBe("a");
```

### An optional chain on a property
```ts
declare const findUser: (id: string) => { readonly name: string } | undefined;
expect(findUser("a")?.name).toBe("Ada");
```

Assert the value is defined, then read it:

```ts
declare const findUser: (id: string) => { readonly name: string } | undefined;
const user = findUser("a");
assert.isDefined(user);
expect(user.name).toBe("Ada");
```

### An optional call
```ts
declare const observers: { readonly enter?: (node: string) => string };
expect(observers.enter?.("a")).toBe("entered a");
```

Destructure the function and assert it is defined, then call it:

```ts
declare const observers: { readonly enter?: (node: string) => string };
const { enter } = observers;
assert.isDefined(enter);
expect(enter("a")).toBe("entered a");
```

A method that reads `this` loses it once taken off its object, so assert it is defined where it is and call it there.
