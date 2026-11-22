# Result union

```json
{
  "serves": {
    "rule": "failures-are-values"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"it makes the output clear to type system instead of hidden in throws\".",
    "standing": "accepted"
  }
}
```

- **Method:** One shared result type tagged `result`, carrying `value` or `error`. The error is a tagged union of our own with a `kind`, as plain data. A caller returns a failed result at once, unchanged; where it must choose by failure, it is a `switch` on `kind` with no `default`.
- **You can tell because:** No `throw` between units of ours. No failure is returned as `null`, `false`, `[]` or a default.
- **Industry name:** Result type (Wlaschin).

[Failure mapping at the adapter](failure-mapping-at-the-adapter.md) also serves this rule.
