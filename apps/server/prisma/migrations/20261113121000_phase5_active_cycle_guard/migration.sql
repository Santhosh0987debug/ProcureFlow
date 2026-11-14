-- Belt-and-braces guard: a purchase request may have at most one active
-- approval cycle. The approval service also enforces this inside a transaction
-- that locks the purchase request row.
CREATE UNIQUE INDEX "approvals_one_pending_per_request"
ON "approvals" ("purchase_request_id")
WHERE "status" = 'pending';
