# Companion test file

```json
{
  "serves": [
    {
      "rule": "tested-where-its-owned"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"if its a unit test it covers the unit it is the companion file to\".",
    "standing": "accepted"
  }
}
```

- **Method:** `name.ts` has `name.test.ts` beside it. The test imports the unit and runs it.
- **You can tell because:** Each file with a runtime export has a sibling that runs it.
- **Industry name:** the same convention as Go's `_test.go` files beside the package.
