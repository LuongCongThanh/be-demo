# Todo List (NestJS Learning Project)

A single-user task tracker built to practice core NestJS concepts (modules, controllers, services, DI, DTOs/validation).

## Language

**Todo**:
A single task item held in one flat, unscoped collection. There is no grouping concept (no lists/projects/boards) — every Todo lives in the same collection.
_Avoid_: Task, item, todo list (ambiguous — see below)

**Todo list** (informal name only):
Refers to the whole collection of Todos, not a domain entity of its own. Do not model as a `TodoList` class/table — there is exactly one implicit collection.
_Avoid_: List, project, board
