# Ports declared inside

```json
{
  "principle": "external-behaviour-sits-at-a-boundary",
  "standing": "accepted"
}
```

- **What must hold:** Business logic declares every port it is handed and names it for the capability it needs, never for the mechanism behind it.
- **Source:** Martin's DIP: the abstraction belongs to the side that uses it.

The clock, random values, new ids and outside ordering are a case: the principle plus Ports declared inside give it. An outside dependency is not wrapped: it is used inside the boundary that needs it.

- **Review:** dependencies point inward and an inner layer never imports an outer one
- **Review:** process signals, exit, kill and high-resolution timing arrive through an injected port
