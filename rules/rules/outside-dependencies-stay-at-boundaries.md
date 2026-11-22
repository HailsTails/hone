# Outside dependencies stay at boundaries

```json
{
  "principle": "external-behaviour-sits-at-a-boundary",
  "standing": "accepted"
}
```

- **What must hold:** Production code uses an outside dependency only inside a recorded boundary, and no type from an outside dependency or a runtime library appears in business logic.
- **Source:** Freeman and Pryce wrap outside types thinly; this rule does so for every outside dependency.
