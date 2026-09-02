-- dim_agent: conformed agent dimension (cash-in point).

SELECT
    agent_id,
    name,
    location,
    float_balance AS current_float
FROM {{ ref('stg_agents') }}
