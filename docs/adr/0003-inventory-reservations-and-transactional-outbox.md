# Use explicit inventory reservations and a transactional outbox

Checkout will represent every time-limited stock hold as an Inventory Reservation in PostgreSQL and write domain events to an outbox in the same transaction as the Order and stock aggregate changes. This costs more schema and worker complexity than only updating `reserved_quantity` or publishing directly to BullMQ, but it provides auditable expiry, safe recovery, and at-least-once event delivery across multiple API instances without making Redis a source of truth.
