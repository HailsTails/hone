# Assert to narrow

```json
{
  "serves": {
    "rule": "straight-through-tests"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"use vi assert to validate it's existence first to narrow the type to exclude the need for optional chain\".",
    "standing": "accepted"
  }
}
```

- **Method:** A value that may be absent or one of several outcomes is narrowed with the framework's `assert` first. After that, plain `expect` reads it.
- **You can tell because:** No `?.`, `&&`, `if` or ternary in the test.
- **Industry name:** Guard Assertion (Meszaros).
