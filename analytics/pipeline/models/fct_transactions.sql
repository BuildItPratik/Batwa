-- fct_transactions: one row per operational event (the fact grain).
-- Joins conformed dimensions by natural key for readable analysis, and
-- denormalises a few date attributes. Design note: this single fact spans
-- money-movement (TOPUP/PAYMENT) and lifecycle (BLOCK/REISSUE) events; a
-- conformed design could split money-movement facts. Documented in README.

SELECT
    t.txn_id,
    t.occurred_at,
    t.occurred_date,
    dd.year_no,
    dd.month_no,
    dd.weekday_name,
    t.type,
    t.status,
    t.is_success,
    t.failure_reason,
    t.amount,
    t.customer_delta,
    t.customer_id,
    c.name AS customer_name,
    t.counterparty_id,
    t.counterparty_role,
    CASE t.counterparty_role
        WHEN 'agent'    THEN ag.name
        WHEN 'merchant' THEN me.name
        ELSE NULL
    END AS counterparty_name
FROM {{ ref('stg_transactions') }} t
LEFT JOIN {{ ref('dim_customer') }} c
    ON c.customer_id = t.customer_id
LEFT JOIN {{ ref('dim_agent') }} ag
    ON ag.agent_id = t.counterparty_id AND t.counterparty_role = 'agent'
LEFT JOIN {{ ref('dim_merchant') }} me
    ON me.merchant_id = t.counterparty_id AND t.counterparty_role = 'merchant'
LEFT JOIN {{ ref('dim_date') }} dd
    ON dd.date_key = t.occurred_date
