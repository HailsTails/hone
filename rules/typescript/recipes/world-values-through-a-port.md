# World values through a port

```json
{
  "serves": {
    "rule": "ports-declared-inside"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"date creates non determinism and leaks the world in\"; \"we have a uuid factory, you should not be importing dependencies\".",
    "standing": "accepted"
  }
}
```

- **Method:** The current time, new ids, random values and process lifecycle each come from a port: `clock.now()`, `ids.next()`. A stub returns a written-out value.
- **You can tell because:** No `Date.now()`, `new Date()`, `randomUUID` or `process.exit` outside their adapters.
- **Industry name:** Volatile Dependencies (Seemann).
