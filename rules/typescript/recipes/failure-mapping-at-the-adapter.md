# Failure mapping at the adapter

```json
{
  "serves": {
    "principle": "no-leak-across-a-boundary"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"They are about speaking the language of the caller at the boundary.\"",
    "standing": "proposed"
  }
}
```

- **Method:** The adapter turns a library's throw into a failure variant of ours. At the program's edge, it turns our failure into the caller's form: an exit code, a status, or a throw where that caller's contract is exceptions.
- **You can tell because:** No `throw` except at an adapter whose caller expects one.
- **Industry name:** anticorruption layer (Evans), applied to failures.

Failure mapping at the adapter also serves Failures are values.
