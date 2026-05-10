# FINAL-1 Full Route and Build QA Report

Branch: feature/rag-sql-vector-next
Protected branch: main remains untouched
Frozen benchmark branch: feature/rag-sql-ai-orchestrator remains untouched

Status: **PASS**

## Build

- npm run build: PASS

## Route smoke checks

| Route | OK | Status | Error |
|---|---:|---:|---|
| http://localhost:3000/ | True | 200 |  |
| http://localhost:3000/gold-ai | True | 200 |  |
| http://localhost:3000/data-matrix | True | 200 |  |
| http://localhost:3000/deep-ml/models/final-deep-ml-evaluation | True | 200 |  |
| http://localhost:3000/api/market/gold-actuals?start=2026-05-05&end=2026-05-11 | True | 200 |  |

## RAG API smoke check

- /api/rag-ai POST ok: True
- orchestration.level: RAG + SQL + Vector
- vectorRetrieval.active: True
- retrievalSummary.vectorHits: 8

## Yahoo actual overlay API

- /api/market/gold-actuals ok: True
- rowCount: 4

## Safe status

- RAG + SQL + Vector milestone is active.
- SQL context remains read-only.
- Vector matches remain retrieval candidates only.
- Forecasts remain model outputs for review, not guarantees.
- LangChain.js, LlamaIndex, auto SQL tools, scheduled refresh, and model reruns remain future phases.

## Decision

If this report is PASS, move to FINAL-2 final branch report.
Do not merge main until FINAL-2 is complete and package-lock/package.json changes are reviewed.
