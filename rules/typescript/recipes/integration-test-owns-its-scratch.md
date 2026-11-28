# Integration test owns its scratch

```json
{
  "serves": [
    {
      "rule": "tested-where-its-owned"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "An ambient setting broke the shared checkout three times; each fix to one instance left the class open.",
    "standing": "proposed"
  }
}
```

- **Method:** Only an integration test touches a real file or subprocess. It makes its own temporary directory, gives every subprocess an explicit environment, and removes the directory after. The environment comes from a unit of ours with its own test, not a test helper.
- **You can tell because:** No unit test touches disk or spawns a process. No integration test reads `process.env` or inherits git settings.
- **Industry name:** Fresh Fixture (Meszaros).
