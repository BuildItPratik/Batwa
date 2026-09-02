-- dim_card: conformed card dimension.
-- is_current marks the card a customer would use today. Reissued cards keep
-- history: the old card stays present with status 'blocked'.

SELECT
    card_id,
    customer_id,
    status,
    issued_on,
    (status = 'active') AS is_current
FROM {{ ref('stg_cards') }}
