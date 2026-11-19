# Triage Labels

The engineering skills use the following canonical triage state labels in this repository.

| Label in mattpocock/skills | Label in this repo | Meaning                                    |
| -------------------------- | ------------------ | ------------------------------------------ |
| `needs-triage`             | `needs-triage`     | Maintainer needs to evaluate the task      |
| `needs-info`               | `needs-info`       | Waiting for more information               |
| `ready-for-agent`          | `ready-for-agent`  | Fully specified and ready for an AFK agent |
| `ready-for-human`          | `ready-for-human`  | Requires human implementation              |
| `wontfix`                  | `wontfix`          | Will not be actioned                       |

For local Markdown tasks, record the label as a `status` value near the top of the task file:

```yaml
status: needs-triage
```

Edit the "Label in this repo" column if the repository adopts a different local tracking vocabulary.
