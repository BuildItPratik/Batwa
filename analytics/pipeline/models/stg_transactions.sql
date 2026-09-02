-- stg_transactions: clean + type the raw event feed.
-- * timestamps are parsed (bronze keeps them as VARCHAR)
-- * derived flags/roles make downstream SQL simpler and consistent
--   (customer_delta is the rupee effect on the customer's balance)

SELECT
    txn_id,
    type,
    status,
    failure_reason,
    amount,
    customer_id,
    counterparty_id,
    COALESCE(
        try_strptime(timestamp, '%Y-%m-%d %H:%M:%S'),
        try_strptime(timestamp, '%Y-%m-%dT%H:%M:%S')
    ) AS occurred_at,
    occurred_date,
    (status = 'SUCCESS') AS is_success,
    CASE
        WHEN type = 'TOPUP'   THEN 'agent'
        WHEN type = 'PAYMENT' THEN 'merchant'
        ELSE NULL
    END AS counterparty_role,
    CASE
        WHEN type = 'TOPUP'   AND status = 'SUCCESS' THEN amount
        WHEN type = 'PAYMENT' AND status = 'SUCCESS' THEN -amount
        ELSE 0
    END AS customer_delta
FROM (
    SELECT
        *,
        COALESCE(
            try_strptime(timestamp, '%Y-%m-%d %H:%M:%S'),
            try_strptime(timestamp, '%Y-%m-%dT%H:%M:%S')
        )::DATE AS occurred_date
    FROM raw.transactions
)
