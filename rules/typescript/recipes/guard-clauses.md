# Guard clauses

```json
{
  "serves": [
    {
      "rule": "guard-first"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"If nested it's a poorly modelled set of questions for a single job.\"",
    "standing": "accepted"
  }
}
```

- **Method:** Each ending condition is `if (...) return ...;` at the top. There is no `else` after a return. The work is the last return.
- **You can tell because:** No `if` sits inside another `if`. There is no `else` after an exit.
- **Industry name:** Replace Nested Conditional with Guard Clauses (Fowler).
