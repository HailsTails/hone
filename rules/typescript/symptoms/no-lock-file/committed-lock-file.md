# committed-lock-file

```json
{
  "misses": "Package managers with an unrecognised lock file.",
  "settingsTracedTo": "None."
}
```

Dependencies declared without an applicable tracked lock file.

A recognised lock file covers manifests in its own directory and every directory below it. A tracked lock at the repository root therefore covers all nested manifests. The check uses directory ancestry and does not check whether the package manager lists a nested package as a workspace member.
