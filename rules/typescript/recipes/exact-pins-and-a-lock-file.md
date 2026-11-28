# Exact pins and a lock file

```json
{
  "serves": [
    {
      "rule": "fixed-versions"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"dependencies must be pinned\"; \"If we ship with dependencies we need lock files.\"",
    "standing": "accepted"
  }
}
```

- **Method:** Every version we run is exact: dev dependencies, tools, CI runtimes and actions carry no `^`, `~` or tag, and the lock file is committed. The range a published package offers its adopters is not a version we run.
- **You can tell because:** No range, and no tag such as `latest`.
- **Industry name:** Pinned-Dependencies (OpenSSF Scorecard).
