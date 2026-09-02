-- dim_date: date spine derived from the observed transaction calendar.
-- Attribute columns support time-series reporting without repeating date math
-- in every downstream query.

SELECT
    d AS date_key,
    extract(year FROM d)  AS year_no,
    extract(month FROM d) AS month_no,
    extract(day FROM d)   AS day_no,
    strftime(d, '%A')     AS weekday_name,
    (strftime(d, '%A') IN ('Saturday', 'Sunday')) AS is_weekend,
    strftime(d, '%Y-%m')  AS month_key
FROM (
    SELECT DISTINCT occurred_date AS d
    FROM {{ ref('stg_transactions') }}
    WHERE occurred_date IS NOT NULL
) dates
