-- Amounts must never be negative (NULL is allowed for lifecycle events).
SELECT txn_id, amount
FROM gold.fct_transactions
WHERE amount < 0
