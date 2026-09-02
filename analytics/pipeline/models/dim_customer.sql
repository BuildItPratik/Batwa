-- dim_customer: conformed customer dimension.
-- A customer's operational row is current-state (balance mutates in place), so
-- this is SCD type-1 as-of the source snapshot. has_active_card is derived
-- from the card table (a customer can temporarily have none, e.g. blocked).

SELECT
    c.customer_id,
    c.name,
    c.phone,
    c.language_pref,
    c.balance       AS current_balance,
    c.registered_on,
    (a.customer_id IS NOT NULL) AS has_active_card
FROM {{ ref('stg_customers') }} c
LEFT JOIN (
    SELECT DISTINCT customer_id
    FROM {{ ref('stg_cards') }}
    WHERE status = 'active'
) a ON a.customer_id = c.customer_id
