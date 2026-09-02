-- stg_cards: clean + type the card snapshot (status active|blocked).

SELECT
    card_id,
    customer_id,
    status,
    try_strptime(created_at, '%Y-%m-%d %H:%M:%S')::DATE AS issued_on
FROM raw.cards
