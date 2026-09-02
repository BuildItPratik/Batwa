-- stg_merchants: clean + type the merchant snapshot.

SELECT
    merchant_id,
    name,
    wallet_balance
FROM raw.merchants
