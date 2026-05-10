# RAG + SQL + Vector Deployment Notes

Branch: `feature/rag-sql-vector-next`  
Benchmark base branch: `feature/rag-sql-ai-orchestrator`  
Protected production branch: `main`

## Purpose

This note documents how to reproduce the Gold Nexus Alpha RAG + SQL + Vector setup locally or in a deployment environment without exposing secrets.

The current architecture uses:

- approved artifact catalog retrieval
- CSV/JSON/TXT/MD artifact context loading
- optional read-only SQL result context
- optional Upstash Vector retrieval when configured
- OpenRouter LLM generation when configured
- local fallback when provider calls fail

## Professor-safe architecture wording

Current Gold AI can be described as:

> A RAG + SQL + Vector orchestrator layer that retrieves approved project artifacts from a structured catalog, accepts optional read-only SQL result context, optionally retrieves vector-matched artifact records from Upstash Vector when configured, and injects grounded context into the LLM prompt before generating an answer.

Safe boundaries:

- Forecasts are model outputs for review, not guaranteed future prices.
- SQL results are read-only context and do not alter models, forecasts, or artifacts.
- Vector matches are retrieval candidates only.
- Vector matches do not prove model accuracy, production approval, causality, or forecast guarantees.
- Approved artifact content remains the grounded source layer.
- Gamma/news context is interpretive context, not causality.
- LangChain and LlamaIndex are not integrated yet.
- Automatic SQL-tool execution is not active.
- The orchestrator does not train, rerun, validate, or refresh forecasting models.

## Required local environment variables

Create or update `.env.local`.

Do not commit `.env.local`.

```text
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openrouter/free

UPSTASH_VECTOR_REST_URL=your_upstash_vector_rest_url
UPSTASH_VECTOR_REST_TOKEN=your_upstash_vector_rest_token