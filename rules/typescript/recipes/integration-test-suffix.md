# Integration test suffix

```json
{
  "serves": {
    "rule": "tested-where-its-owned"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"a useful pattern to ensure boundaries are clear when to maintain and keep pyramid checkable.\"",
    "standing": "accepted"
  }
}
```

- **Method:** A test of a binding to the outside is named `name.integration.test.ts`. Every other test file is a unit test.
- **You can tell because:** The two kinds can be counted and checked by file name.
- **Industry name:** the same convention as Maven Failsafe's `*IT.java` integration tests.
