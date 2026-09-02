-- status must come from the closed set {SUCCESS, FAILED}.
SELECT DISTINCT status
FROM gold.fct_transactions
WHERE status NOT IN ('SUCCESS', 'FAILED')
