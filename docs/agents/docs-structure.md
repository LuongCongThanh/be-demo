# Documentation folder standard

<!-- Synced from the fashion-store workspace repository (shared/agents/docs-structure.md). Edit it there, not here. -->

Every repository in the Fashion Store workspace lays out `docs/` the same way. Content differs per repository; folder and file names do not. Why: workspace ADR 0004.

## Folders

Create a folder only when there is something to put in it. When it exists, it has this name and this role.

| Folder           | Holds                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/README.md` | Index of the folders below, plus a section **"Khác biệt của repo này"** listing every folder or rule that only this repository has.            |
| `adr/`           | Architecture decision records, `NNNN-<slug>.md`.                                                                                               |
| `agents/`        | Instructions for coding agents: issue tracker, triage labels, workflows. Subfolders are allowed. `workspace.md` and this file are synced here. |
| `architecture/`  | How the system is built: modules, runtime, data flow, integrations.                                                                            |
| `conventions/`   | How to write code here: naming, structure, boundaries, tooling.                                                                                |
| `testing/`       | `strategy.md` and `traceability.md`, plus any other test guidance.                                                                             |
| `business/`      | What the product does: scope, actors, rules, lifecycles.                                                                                       |
| `plan/`          | Work to do and work done (see below).                                                                                                          |
| `research/`      | Investigations and learning material. Not a requirement until a plan or ADR adopts it.                                                         |
| `archive/`       | Documents that no longer apply, kept for reference. Nothing links here as current guidance.                                                    |

A repository may add a folder this table does not list, such as the Backend's `openapi/`. It must list it under "Khác biệt của repo này" in `docs/README.md`.

## `plan/`

```
plan/
  README.md                         status of every Ticket and Initiative
  roadmap.md                        optional: work not yet broken into Tickets
  tasks/{todo,done,wontfix}/<ticket>/
  initiatives/<slug>/map.md         plus issues/, research/, assets/ as needed
```

A Ticket folder is `NN-<slug>`. It holds:

| File          | Required         | Role                                                                                      |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `spec.md`     | yes              | Requirement, acceptance criteria and the Ticket's status. The source of truth for status. |
| `plan.md`     | once work starts | Steps to deliver it.                                                                      |
| `guide.md`    | no               | Target layout or design.                                                                  |
| `manifest.md` | no               | Files in scope.                                                                           |
| `metric.md`   | no               | Measurements before and after.                                                            |
| `report.md`   | when done        | Outcome and how it differed from the plan.                                                |
| `issues/`     | no               | Sub-issues.                                                                               |

Move the folder between `todo/`, `done/` and `wontfix/` when its status changes.

## Root files

`README.md`, `AGENTS.md`, `CLAUDE.md`, `GLOSSARY.md` and `CONTRIBUTING.md` (Git, commit and PR rules) in every application. `DESIGN.md` in the CMS and Storefront. `SECURITY.md` in the Backend. Names are upper case.

## Moving a document

Use `git mv`, and fix every relative link to it in the same PR. Do not leave a redirect file behind.
