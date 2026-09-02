-- stg_agents: clean + type the agent snapshot.

SELECT
    agent_id,
    name,
    location,
    float_balance
FROM raw.agents
