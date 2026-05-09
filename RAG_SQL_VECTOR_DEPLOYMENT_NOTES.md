# RAG + SQL + Vector Deployment Notes

Branch: feature/rag-sql-vector-next
Benchmark branch: feature/rag-sql-ai-orchestrator
Protected branch: main

## Purpose

This note documents how to reproduce the Gold Nexus Alpha RAG + SQL + Vector setup locally or in deployment without exposing secrets.

Current architecture:
- approved artifact catalog retrieval
- CSV/JSON/TXT/MD artifact context loading
- optional read-only SQL result context
- optional Upstash Vector retrieval when configured
- OpenRouter LLM generation when configured
- local fallback when provider calls fail

## Professor-safe wording

Current Gold AI can be described as a RAG + SQL + Vector orchestrator layer that retrieves approved project artifacts from a structured catalog, accepts optional read-only SQL result context, optionally retrieves vector-matched artifact records from Upstash Vector when configured, and injects grounded context into the LLM prompt before generating an answer.

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

Create or update .env.local.

Do not commit .env.local.

OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openrouter/free
UPSTASH_VECTOR_REST_URL=your_upstash_vector_rest_url
UPSTASH_VECTOR_REST_TOKEN=your_upstash_vector_rest_token

If OpenRouter variables are missing, local fallback is used.
If Upstash variables are missing, structured artifact retrieval and optional SQL context still work.

## Local commands

git switch feature/rag-sql-vector-next
git status
npm install
Remove-Item -Recurse -Force .\.next -ErrorAction SilentlyContinue
npm run build
npm run dev

Open:
http://localhost:3000/gold-ai

Expected UI indicators:
- RAG + SQL + Vector
- Upstash Vector wired
- vector sources exposed
- SQL context optional
- legacy route retained

## Vector manifest rebuild

py .\scripts\build_upstash_vector_artifact_index.py

Expected:
- output file: public/artifacts/vector/gold_artifact_vector_manifest.json
- records: about 305

The generated vector records are retrieval context only. They do not alter forecasts, models, or source artifacts.

## Upstash Vector upload

Use only after UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN are configured.

Small test:
py .\scripts\upload_upstash_vector_manifest.py --limit 10 --upload --query "forecast governance cutoff date"

Full upload:
py .\scripts\upload_upstash_vector_manifest.py --upload --query "Omega forecast evaluation artifacts"

The script uses:
- /upsert-data for upload
- /query-data for retrieval

The Upstash index must use a built-in embedding model such as BAAI/bge-small-en-v1.5. A custom raw-vector index does not support /upsert-data.

## API smoke test

With npm run dev running, POST to:
http://localhost:3000/api/rag-ai

Expected when Upstash is configured:
- orchestration.level = RAG + SQL + Vector
- vectorRetrieval.active = true
- vectorRetrieval.matchCount greater than 0
- vectorSources count greater than 0
- retrievalSummary.vectorHits greater than 0
- sources includes Vector-prefixed labels

## Deployment notes

For Vercel or another deployment provider, add secrets through the provider dashboard, not through committed files.

Required deployment variables:
- OPENROUTER_API_KEY
- OPENROUTER_MODEL
- UPSTASH_VECTOR_REST_URL
- UPSTASH_VECTOR_REST_TOKEN

Do not commit:
- .env.local
- .env
- secrets
- tokens
- provider dashboard screenshots containing tokens

This branch does not require changes to:
- next.config.ts
- vercel.json
- Vercel build settings

## Verification checklist

Before marking deployment-ready:
- npm run build passes.
- /gold-ai loads.
- Gold AI Studio architecture panel shows RAG + SQL + Vector wording.
- /api/rag-ai works with artifact retrieval even without vector env variables.
- /api/rag-ai returns vector matches when Upstash env variables are configured.
- .env.local is ignored by Git.
- No secrets are committed.
- No main branch merge has been performed.

## Current limitations

Not active yet:
- LangChain integration
- LlamaIndex integration
- automatic SQL-tool execution by the orchestrator
- automatic artifact refresh
- scheduled data updates
- model training, rerun, or validation orchestration
