-- kpi_daily_volume: reporting aggregate used by the report step.
-- Row grain = (date, type, status). amount_total sums non-null amounts.

SELECT
    occurred_date AS date_key,
    type,
    status,
    COUNT(*)              AS txn_count,
    COALESCE(SUM(amount), 0) AS amount_total
FROM {{ ref('fct_transactions') }}
GROUP BY 1, 2, 3
