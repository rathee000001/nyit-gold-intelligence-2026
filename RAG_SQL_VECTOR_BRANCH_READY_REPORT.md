# RAG + SQL + Vector Branch Ready Report

Branch: feature/rag-sql-ai-orchestrator  
Protected main: not touched

## Final status

This branch upgrades Gold Nexus Alpha from a Level 1 artifact-grounded RAG-style AI layer into a RAG + SQL + Vector orchestrator branch.

The system now supports:
- structured artifact catalog retrieval
- loaded CSV/JSON/TXT/MD artifact context
- optional read-only SQL result context
- Upstash Vector retrieval when environment variables and vector index records are configured
- OpenRouter LLM generation when configured
- local fallback when provider calls fail
- professor-safe grounding rules and forecast disclaimers

## SQL phases completed

- SQL-1: Data Matrix SQL Explorer
- SQL-2: Gold AI Blob Catalog SQL Explorer
- SQL-2B: Blob SQL to Visual Lab Bridge
- SQL-4A: Final Deep ML Evaluation SQL Explorer

SQL usage is read-only. SQL outputs inspect table rows or artifact metadata and do not alter forecasts, models, or source artifacts.

## RAG phases completed

- RAG-1: Shared `/api/rag-ai` orchestrator route
- RAG-2: Gradual UI migration from `/api/gold-ai` to `/api/rag-ai`
- RAG-3: Legacy route scan and architecture status cleanup

The legacy `/api/gold-ai` route remains retained as a fallback route.

## Vector phases completed

- VECTOR-2A: Vector provider abstraction
- VECTOR-2B: Artifact vector manifest builder
- VECTOR-2C: Upstash upload and query-data integration
- VECTOR-2D: Vector sources and retrieval summary exposed by orchestrator
- VECTOR-2E: Gold AI Studio architecture panel updated for RAG + SQL + Vector
- VECTOR-2F: Final QA and branch-ready report

## Current architecture wording

Current Gold AI is a RAG + SQL + Vector orchestrator layer. It retrieves approved CSV/JSON/TXT/MD artifacts from a structured catalog, accepts optional read-only SQL result context, and can use Upstash Vector matches as retrieval candidates when configured. It then injects grounded context into the LLM prompt before generating an answer.

## Professor-safe boundaries

- Forecasts are model outputs for review, not guaranteed future prices.
- Vector matches are retrieval candidates only.
- SQL results are read-only context and do not prove model quality.
- Gamma/news context is interpretive context, not causality.
- Model accuracy, production approval, causality, and forecast guarantees must not be claimed unless directly supported by approved artifacts.
- LangChain/LlamaIndex integration is not active.
- Automatic SQL tool execution is not active.
- The orchestrator does not train, rerun, validate, or refresh forecasting models.

## Required environment variables for vector retrieval

These are local/deployment secrets and must not be committed:

- UPSTASH_VECTOR_REST_URL
- UPSTASH_VECTOR_REST_TOKEN

If the variables are missing, the app safely falls back to structured artifact retrieval and optional SQL context.

## Final QA acceptance

Accepted when:

- `npm run build` passes.
- `/gold-ai` architecture panel shows RAG + SQL + Vector and Upstash Vector wired.
- `/api/rag-ai` returns `orchestration.level = RAG + SQL + Vector` when Upstash is configured and returns matches.
- `/api/rag-ai` exposes `vectorSources`.
- `/api/rag-ai` exposes `retrievalSummary.vectorHits`.
- `sources` includes Vector-prefixed source labels.
- `.env.local` is ignored and not committed.
- No main branch merge has been performed.