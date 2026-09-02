-- failure_reason must obey backend semantics:
--   1) SUCCESS rows never carry a reason
--   2) FAILED rows carry only an allowed, documented reason
--      (whitelist mirrors config.FAILURE_REASONS; includes AGENT_NOT_FOUND,
--       which the code emits though the API reference omits it)
--   3) lifecycle events (BLOCK / REISSUE) never carry a reason
--   4) an over-limit payment must be a FAILED LIMIT_EXCEEDED attempt
SELECT txn_id, 'success_with_reason' AS issue
FROM gold.fct_transactions
WHERE status = 'SUCCESS' AND failure_reason IS NOT NULL
UNION ALL
SELECT txn_id, 'disallowed_failure_reason'
FROM gold.fct_transactions
WHERE status = 'FAILED'
  AND failure_reason NOT IN (
    'WRONG_PIN', 'INSUFFICIENT_BALANCE', 'BLOCKED_CARD', 'LIMIT_EXCEEDED',
    'AGENT_FLOAT_INSUFFICIENT', 'AGENT_NOT_FOUND', 'CARD_NOT_FOUND',
    'MERCHANT_NOT_FOUND'
  )
UNION ALL
SELECT txn_id, 'lifecycle_with_reason'
FROM gold.fct_transactions
WHERE type IN ('BLOCK', 'REISSUE') AND failure_reason IS NOT NULL
UNION ALL
SELECT txn_id, 'over_limit_not_rejected_as_such'
FROM gold.fct_transactions
WHERE type = 'PAYMENT' AND amount > 100
  AND NOT (status = 'FAILED' AND failure_reason = 'LIMIT_EXCEEDED')
