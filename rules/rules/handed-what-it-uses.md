# Handed what it uses

```json
{
  "principle": "one-place-decides",
  "standing": "accepted"
}
```

- **What must hold:** A unit is handed only what it uses: a port holds only the methods its one consumer calls; a doer takes only the fields it reads, or the entity whose module it is in; an orchestrator may pass an entity whole.
- **Source:** This is dependency injection, as Fowler describes it, serving Martin's DIP.
