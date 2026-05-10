# RAG + SQL + Vector Architecture Explanation

Branch: `feature/rag-sql-vector-next`  
Benchmark branch: `feature/rag-sql-ai-orchestrator`  
Protected branch: `main`

## Executive summary

Gold Nexus Alpha now has a RAG + SQL + Vector AI orchestration layer.

The system retrieves approved project artifacts, accepts optional read-only SQL preview context, optionally retrieves vector-matched artifact records from Upstash Vector, and then sends grounded context to the LLM generation layer.

This architecture is designed for project explanation, artifact traceability, and professor-safe AI answers. It does not train forecasting models, rerun models, validate forecasts, refresh artifacts, or guarantee future prices.

## Current architecture

The current AI layer contains these active parts:

| Layer | Status | Explanation |
|---|---:|---|
| `/api/rag-ai` route | Active | Shared API endpoint for RAG-style AI calls. |
| `src/lib/ragAiOrchestrator.ts` | Active | Main orchestration layer that combines page context, artifacts, SQL context, vector matches, and LLM generation. |
| Page-aware routing | Active | The orchestrator uses page path/profile logic to select relevant context. |
| Structured artifact retrieval | Active | Approved project artifacts are selected from the artifact catalog. |
| Artifact context loading | Active | Selected CSV/JSON/TXT/MD artifacts can be loaded as grounding context. |
| Optional SQL result context | Active | Pages can pass read-only SQL preview rows into the orchestrator. |
| Upstash Vector retrieval | Active when configured | Vector matches are retrieved when Upstash environment variables and vector index records are available. |
| OpenRouter LLM generation | Active when configured | Used when `OPENROUTER_API_KEY` is available. |
| Local fallback | Active | Used when provider key is missing or provider calls fail. |
| Legacy `/api/gold-ai` route | Retained | Kept as a fallback route. |

## What happens when a user asks a question

1. The UI sends the question to `/api/rag-ai`.
2. The orchestrator reads the page path and question.
3. Page-aware routing selects a project profile.
4. The approved artifact catalog selects relevant artifacts.
5. Artifact context is loaded from CSV/JSON/TXT/MD files.
6. If the page supplies SQL context, the SQL preview rows are added as read-only context.
7. If Upstash Vector is configured, vector matches are retrieved as candidate context.
8. The orchestrator builds a professor-safe prompt.
9. The LLM generates an answer.
10. The response returns answer text plus metadata:
   - selected artifacts
   - sources
   - vector sources
   - retrieval summary
   - SQL context status
   - orchestration level

## RAG layer

The RAG layer is artifact-grounded.

It uses the approved artifact catalog and artifact files as the source of truth for project claims. It can explain pages, forecasts, model outputs, artifact metadata, and evaluation files, but it should not invent claims beyond the available artifacts.

Safe wording:

> The system uses RAG-style artifact retrieval from a structured artifact catalog and selected approved CSV/JSON/TXT/MD artifacts.

Unsafe wording to avoid:

> The system guarantees forecast accuracy.

> The system is production-approved.

> The system proves model reliability.

## SQL layer

The SQL layer is read-only.

SQL explorers allow users to query artifact metadata or page-level tables. SQL results can be passed into the RAG orchestrator as `sqlContext`.

The SQL layer can support answers such as:

- what rows are shown
- which artifact group appears most often
- which paths or labels match a query
- how artifacts are organized
- what metadata fields are present

The SQL layer must not be used to claim:

- model accuracy
- production readiness
- causal impact
- validation strength
- forecast guarantees
- approval status

Safe SQL wording:

> This SQL result shows artifact metadata or preview rows. Deeper claims require opening the artifact or governance file.

## Vector layer

The vector layer is active when Upstash Vector is configured and returns matches.

The vector layer uses a generated artifact vector manifest and Upstash Vector retrieval. Vector records are based on approved artifact metadata and preview text.

Vector matches are useful for search and retrieval, but they are not proof.

Safe vector wording:

> Vector matches are retrieval candidates only. They help identify relevant artifact records, but approved artifact content remains the grounded source layer.

The vector layer does not:

- replace approved artifacts
- prove forecast quality
- validate model performance
- prove causality
- update artifacts
- train models
- guarantee prices

## Combined SQL + Vector explain mode

Gold AI can now explain SQL results using three context layers:

1. SQL preview rows
2. approved artifact sources
3. vector-matched retrieval candidates

This mode is useful when a user clicks an AI explanation button after running a SQL query.

Required safe structure:

1. Explain what the SQL preview rows show.
2. Mention approved artifacts used for grounding.
3. Mention vector matches only as retrieval candidates.
4. Include the caution that SQL rows and vector matches do not prove model quality.

Example safe caution:

> This interpretation is based on SQL metadata or preview rows only; deeper claims require opening the artifact or governance file.

## Final Deep ML chart overlay

The Final Deep ML Evaluation page can overlay observed Yahoo/GC=F actual gold prices on the forecast chart.

This overlay is for visual comparison only.

Safe wording:

> Green actual dots are observed Yahoo/GC=F prices for visual comparison only. They do not alter forecast artifacts, retrain models, validate model accuracy, or guarantee future prices.

The chart may show:

- Deep ML forecast
- lower and upper interval band
- observed actual dots where Yahoo data exists
- visual residual
- visual APE

Residual and APE are visual calculations only where actual data exists.

## Forecast safety boundaries

Forecast paths are model outputs for review.

Do not claim:

- guaranteed future prices
- high accuracy
- reliable forecast
- production-ready status
- confidence score above 95%
- industry benchmark comparison
- directional accuracy strength
- cost savings
- operational efficiency impact
- causal Gamma/news impact

Allowed wording:

- forecast path
- model output
- artifact-backed forecast output
- uncertainty band
- visual comparison
- read-only SQL metadata
- vector retrieval candidate

## What is not active yet

These features are not active in the current core branch:

| Feature | Status | Notes |
|---|---:|---|
| LangChain integration | Not active yet | Future framework phase. |
| LlamaIndex integration | Not active yet | Optional comparison after LangChain decision. |
| Automatic SQL tool execution | Not active yet | Current SQL is supplied by pages; the orchestrator does not run SQL by itself. |
| Scheduled artifact refresh | Not active yet | No automatic refresh pipeline is active. |
| Model rerun/training orchestration | Not active yet | The orchestrator does not train, rerun, or validate forecasting models. |
| Vector-only mode | Not active by design | Artifact catalog remains the primary grounding source. |

## Future framework roadmap

After the core final polish is complete, the next framework phase can begin.

Recommended order:

1. `FRAMEWORK-1 - LangChain.js wrapper`
   - Add a thin LangChain.js orchestration wrapper around the existing RAG + SQL + Vector flow.
   - Keep current professor-safe rules.
   - Do not replace the approved artifact catalog.
   - Do not enable autonomous tools yet.

2. `FRAMEWORK-2 - Optional LlamaIndex comparison`
   - Evaluate whether LlamaIndex adds value for document indexing or retrieval.
   - Keep it optional unless it clearly improves the project.

3. `TOOLS-1 - Auto SQL tool execution`
   - Only after framework wiring is stable.
   - The AI could choose a safe read-only SQL query from an allowlist.
   - No write queries.
   - No model/artifact mutation.

4. `OPS-1 - Scheduled refresh`
   - Only after safety and governance documentation.
   - Would require clear logging and no hidden model changes.

5. `MODEL-OPS-1 - Model rerun orchestration`
   - Last stage.
   - Requires validation governance and explicit approval boundaries.

## Professor-safe explanation

A concise explanation:

> Gold Nexus Alpha uses a RAG + SQL + Vector orchestrator. The AI retrieves approved project artifacts, optionally uses read-only SQL preview rows, optionally uses Upstash Vector matches as retrieval candidates, and then generates an answer with grounded context. SQL and vector retrieval improve traceability, but they do not prove forecast accuracy, production readiness, causality, or guaranteed prices.

## Deployment and secrets

Required local or deployment secrets:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `UPSTASH_VECTOR_REST_URL`
- `UPSTASH_VECTOR_REST_TOKEN`

Do not commit:

- `.env.local`
- `.env`
- tokens
- provider dashboard screenshots containing secrets

## Branch policy

`main` remains untouched.

`feature/rag-sql-ai-orchestrator` remains the frozen benchmark branch.

`feature/rag-sql-vector-next` is the active forward branch.
