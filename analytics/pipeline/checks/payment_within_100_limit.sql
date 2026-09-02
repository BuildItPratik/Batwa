-- Backend rule: successful payments may never exceed Rs.100 (txn_service
-- PAYMENT_LIMIT). A payment over Rs.100 is only legitimate as a FAILED
-- LIMIT_EXCEEDED attempt (covered by failure_reason_consistency).
SELECT txn_id, amount
FROM gold.fct_transactions
WHERE type = 'PAYMENT' AND status = 'SUCCESS' AND amount > 100
