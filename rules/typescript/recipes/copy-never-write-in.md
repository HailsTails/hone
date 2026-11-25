# Copy, never write in

```json
{
  "serves": [
    {
      "principle": "no-hidden-effects"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"this is giving mutation of input args vibes, not okay\"; \"pure functions are required\".",
    "standing": "accepted"
  }
}
```

- **Method:** A changed value is a new one: `{ ...order, total }` or `[...items].sort()`. Nothing writes to, deletes from, or rebinds a parameter.
- **You can tell because:** No assignment to a parameter or its fields.
- **Industry name:** immutability; Value Object (Fowler).
