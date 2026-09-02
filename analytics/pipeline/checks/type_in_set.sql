-- type must come from the closed set {TOPUP, PAYMENT, REISSUE, BLOCK}.
SELECT DISTINCT type
FROM gold.fct_transactions
WHERE type NOT IN ('TOPUP', 'PAYMENT', 'REISSUE', 'BLOCK')
