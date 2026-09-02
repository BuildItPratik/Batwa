-- Every transaction that carries a customer_id must reference a known customer.
-- (customer_id is legitimately NULL for CARD_NOT_FOUND / LIMIT_EXCEEDED
--  attempts, where the backend fails before resolving the card.)
SELECT txn_id, customer_id
FROM gold.fct_transactions
WHERE customer_id IS NOT NULL
  AND customer_id NOT IN (SELECT customer_id FROM gold.dim_customer)
