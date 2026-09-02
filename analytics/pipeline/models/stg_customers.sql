-- stg_customers: clean + type the customer snapshot.

SELECT
    customer_id,
    name,
    phone,
    language_pref,
    balance,
    try_strptime(created_at, '%Y-%m-%d %H:%M:%S')::DATE AS registered_on
FROM raw.customers
