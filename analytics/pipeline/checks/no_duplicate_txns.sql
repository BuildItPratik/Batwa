-- Fact grain must be unique on txn_id.
SELECT txn_id, COUNT(*) AS n
FROM gold.fct_transactions
GROUP BY txn_id
HAVING COUNT(*) > 1
