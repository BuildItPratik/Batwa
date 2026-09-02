-- dim_merchant: conformed merchant dimension.
-- The merchant's operational wallet_balance equals its lifetime received
-- payments (merchants start at 0 and are only credited by payments).

SELECT
    merchant_id,
    name,
    wallet_balance AS lifetime_received
FROM {{ ref('stg_merchants') }}
