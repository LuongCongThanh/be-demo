---
name: ship
description: Use only when the user explicitly asks to ship, publish, or open a pull request, or types `/ship`. Verifies, reviews, rebases onto dev, pushes, opens the PR, and watches its checks.
---

# Ship

Run the shared [ship flow](../../../docs/agents/flows/ship.md) (`docs/agents/flows/ship.md`) exactly as written: same steps, same order, same authorization rule, same stop points for every agent.

This entry skill only adapts invocation to the active agent:

- Step 3 uses the vendored `code-review` skill. In Claude Code an argument such as `high` may be passed as the review effort level; other agents ignore it.
- Repository hooks (`enforce-git-workflow`, `enforce-pr-template`, `after-pr-create`) run under each agent's native hook registration. A blocking hook is a stop point: report it, never bypass it.
