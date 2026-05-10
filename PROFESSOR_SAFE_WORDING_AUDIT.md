# Professor-Safe Wording Audit

Created UTC: 2026-05-10T02:17:29.970306+00:00

Branch: `feature/rag-sql-vector-next`

Status: **REVIEW REQUIRED**

## Purpose

This audit checks the RAG + SQL + Vector branch for wording that could sound like unsupported model accuracy, production approval, forecast guarantees, causality, autonomous tool execution, or deployed framework claims.

## Dean-safe milestone wording

The project can be described as a cross-course applied AI milestone: a RAG + SQL + Vector AI orchestrator that explains approved project artifacts, read-only SQL previews, and vector retrieval candidates.

Safe summary:

- Gold Nexus Alpha is an AI-assisted forecasting and decision-support research platform.
- Forecast paths are model outputs for review, not guaranteed future prices.
- SQL context is read-only preview context.
- Vector matches are retrieval candidates only.
- Upstash Vector retrieval is active when configured.
- LangChain.js, LlamaIndex, auto SQL tools, scheduled refresh, and model rerun orchestration are future phases, not active core features.

## Required language boundaries

Do not claim:

- guaranteed forecast prices
- high accuracy or strong performance without artifact evidence
- production approval
- causal Gamma/news impact
- confidence score above 95%
- industry benchmark superiority
- cost savings or operational efficiency impact
- fully autonomous SQL execution
- active LangChain or LlamaIndex integration
- active model rerun/training orchestration

Allowed wording:

- RAG + SQL + Vector orchestrator
- artifact-grounded explanation layer
- read-only SQL preview context
- vector retrieval candidates
- visual comparison overlay
- model outputs for review
- future framework phase

## Scan result

Total risk-term matches reviewed: 135
Blocking unsupported matches: 41

## Blocking matches to review

| File | Line | Term | Text |
|---|---:|---|---|
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1483 | `guarantee` | model accuracy, approval, causality, or forecast guarantees. |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1483 | `causality` | model accuracy, approval, causality, or forecast guarantees. |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1483 | `causal` | model accuracy, approval, causality, or forecast guarantees. |
| `src/lib/ragAiOrchestrator.ts` | 252 | `strong performance` | "strong performance", |
| `src/lib/ragAiOrchestrator.ts` | 253 | `high accuracy` | "high accuracy", |
| `src/lib/ragAiOrchestrator.ts` | 255 | `reliable forecast` | "reliable forecast", |
| `src/lib/ragAiOrchestrator.ts` | 256 | `reliable forecast` | "reliable forecasts", |
| `src/lib/ragAiOrchestrator.ts` | 257 | `industry benchmark` | "below industry benchmark", |
| `src/lib/ragAiOrchestrator.ts` | 258 | `industry benchmark` | "industry benchmark", |
| `src/lib/ragAiOrchestrator.ts` | 259 | `directional accuracy` | "directional accuracy", |
| `src/lib/ragAiOrchestrator.ts` | 260 | `confidence score` | "confidence score", |
| `src/lib/ragAiOrchestrator.ts` | 263 | `production-ready` | "production-ready", |
| `src/lib/ragAiOrchestrator.ts` | 265 | `cost savings` | "cost savings", |
| `src/lib/ragAiOrchestrator.ts` | 270 | `guarantee` | "guarantee", |
| `src/lib/ragAiOrchestrator.ts` | 271 | `guarantee` | "guaranteed", |
| `src/lib/ragAiOrchestrator.ts` | 271 | `guaranteed` | "guaranteed", |
| `src/lib/ragAiOrchestrator.ts` | 303 | `strong performance` | "- Model accuracy or strong performance.", |
| `src/lib/ragAiOrchestrator.ts` | 306 | `causality` | "- Causality from Gamma/news context.", |
| `src/lib/ragAiOrchestrator.ts` | 306 | `causal` | "- Causality from Gamma/news context.", |
| `src/lib/ragAiOrchestrator.ts` | 328 | `high accuracy` | "- High accuracy or strong performance.", |
| `src/lib/ragAiOrchestrator.ts` | 328 | `strong performance` | "- High accuracy or strong performance.", |
| `src/lib/ragAiOrchestrator.ts` | 329 | `industry benchmark` | "- Industry benchmark comparison.", |
| `src/lib/ragAiOrchestrator.ts` | 330 | `confidence score` | "- A confidence score above 95%.", |
| `src/lib/ragAiOrchestrator.ts` | 331 | `directional accuracy` | "- Directional accuracy strength.", |
| `src/lib/ragAiOrchestrator.ts` | 332 | `cost savings` | "- Cost savings or operational efficiency impact.", |
| `src/lib/ragAiOrchestrator.ts` | 332 | `operational efficiency` | "- Cost savings or operational efficiency impact.", |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 63 | `guarantee` | > The system guarantees forecast accuracy. |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 87 | `causal` | - causal impact |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 89 | `guarantee` | - forecast guarantees |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 113 | `causality` | - prove causality |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 113 | `causal` | - prove causality |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 116 | `guarantee` | - guarantee prices |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 166 | `high accuracy` | - high accuracy |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 167 | `reliable forecast` | - reliable forecast |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 168 | `production-ready` | - production-ready status |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 169 | `confidence score` | - confidence score above 95% |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 170 | `industry benchmark` | - industry benchmark comparison |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 171 | `directional accuracy` | - directional accuracy strength |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 172 | `cost savings` | - cost savings |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 173 | `operational efficiency` | - operational efficiency impact |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 174 | `causal` | - causal Gamma/news impact |

## Contextual matches

These matches appear in safe boundary, limitation, or future-roadmap context.

| File | Line | Term | Safe Context | Text |
|---|---:|---|---:|---|
| `src/app/gold-ai/page.tsx` | 399 | `guarantee` | True | Vector matches are retrieval candidates only. Approved artifact content remains the grounded source layer; forecasts are model outputs, not guarantees. |
| `src/app/gold-ai/page.tsx` | 977 | `langchain` | False | "LangChain", |
| `src/app/gold-ai/page.tsx` | 978 | `llamaindex` | False | "LlamaIndex", |
| `src/app/gold-ai/page.tsx` | 979 | `auto sql` | False | "auto SQL tools", |
| `src/app/gold-ai/page.tsx` | 980 | `model rerun` | False | "model reruns", |
| `src/app/gold-ai/page.tsx` | 981 | `scheduled refresh` | False | "scheduled refresh", |
| `src/app/gold-ai/page.tsx` | 1010 | `guarantee` | True | SQL result context, and an LLM generation layer. Forecasts remain artifact outputs, not guarantees. |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1074 | `guarantee` | True | Band source: {row.interval_source \|\| "not available"}. Forecasts are model outputs, not guarantees. Yahoo dots are observed GC=F prices for visual comparison only; they do not alter artifacts or prove quality. |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1483 | `guarantee` | False | model accuracy, approval, causality, or forecast guarantees. |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1483 | `causality` | False | model accuracy, approval, causality, or forecast guarantees. |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1483 | `causal` | False | model accuracy, approval, causality, or forecast guarantees. |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1617 | `guarantee` | True | "Do not infer model quality, approval, causality, validation status, or forecast guarantees from metadata alone.", |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1617 | `causality` | True | "Do not infer model quality, approval, causality, validation status, or forecast guarantees from metadata alone.", |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1617 | `causal` | True | "Do not infer model quality, approval, causality, validation status, or forecast guarantees from metadata alone.", |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1789 | `guarantee` | True | "Do not describe forecasts as guarantees.", |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1790 | `causality` | True | "Do not claim causality from Gamma, news context, weights, or model outputs.", |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 1790 | `causal` | True | "Do not claim causality from Gamma, news context, weights, or model outputs.", |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 2437 | `causality` | True | Gamma/news context is not causality. It helps explain market background around forecast dates, but it does not override the selected model forecast. |
| `src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx` | 2437 | `causal` | True | Gamma/news context is not causality. It helps explain market background around forecast dates, but it does not override the selected model forecast. |
| `src/lib/ragAiOrchestrator.ts` | 54 | `langchain` | True | "LangChain and LlamaIndex are not integrated yet.", |
| `src/lib/ragAiOrchestrator.ts` | 54 | `llamaindex` | True | "LangChain and LlamaIndex are not integrated yet.", |
| `src/lib/ragAiOrchestrator.ts` | 214 | `guarantee` | True | "5. Do not claim model accuracy, production approval, causality, validation, or forecast guarantees from SQL rows or vector matches.", |
| `src/lib/ragAiOrchestrator.ts` | 214 | `causality` | True | "5. Do not claim model accuracy, production approval, causality, validation, or forecast guarantees from SQL rows or vector matches.", |
| `src/lib/ragAiOrchestrator.ts` | 214 | `causal` | True | "5. Do not claim model accuracy, production approval, causality, validation, or forecast guarantees from SQL rows or vector matches.", |
| `src/lib/ragAiOrchestrator.ts` | 234 | `production-ready` | True | "- Do not say the model is performing well, highly accurate, reliable, below industry benchmarks, production-ready, or decision-ready unless the provided artifact context explicitly states that exact claim.", |
| `src/lib/ragAiOrchestrator.ts` | 234 | `industry benchmark` | True | "- Do not say the model is performing well, highly accurate, reliable, below industry benchmarks, production-ready, or decision-ready unless the provided artifact context explicitly states that exact claim.", |
| `src/lib/ragAiOrchestrator.ts` | 235 | `confidence score` | True | "- Do not invent accuracy, confidence score, directional accuracy, industry benchmark, cost saving, operational efficiency, or business impact claims.", |
| `src/lib/ragAiOrchestrator.ts` | 235 | `operational efficiency` | True | "- Do not invent accuracy, confidence score, directional accuracy, industry benchmark, cost saving, operational efficiency, or business impact claims.", |
| `src/lib/ragAiOrchestrator.ts` | 235 | `directional accuracy` | True | "- Do not invent accuracy, confidence score, directional accuracy, industry benchmark, cost saving, operational efficiency, or business impact claims.", |
| `src/lib/ragAiOrchestrator.ts` | 235 | `industry benchmark` | True | "- Do not invent accuracy, confidence score, directional accuracy, industry benchmark, cost saving, operational efficiency, or business impact claims.", |
| `src/lib/ragAiOrchestrator.ts` | 236 | `confidence score` | True | "- Do not call uncertainty bands a confidence score. If lower/upper bands exist, describe them as artifact-provided intervals or uncertainty bands.", |
| `src/lib/ragAiOrchestrator.ts` | 237 | `guarantee` | True | "- Do not describe forecasts as guarantees.", |
| `src/lib/ragAiOrchestrator.ts` | 238 | `causal` | True | "- Do not claim Gamma/news context is causal.", |
| `src/lib/ragAiOrchestrator.ts` | 243 | `guarantee` | True | "- Safe wording: 'The forecast path is a model output for review, not a guaranteed future price path.'", |
| `src/lib/ragAiOrchestrator.ts` | 243 | `guaranteed` | True | "- Safe wording: 'The forecast path is a model output for review, not a guaranteed future price path.'", |
| `src/lib/ragAiOrchestrator.ts` | 252 | `strong performance` | False | "strong performance", |
| `src/lib/ragAiOrchestrator.ts` | 253 | `high accuracy` | False | "high accuracy", |
| `src/lib/ragAiOrchestrator.ts` | 255 | `reliable forecast` | False | "reliable forecast", |
| `src/lib/ragAiOrchestrator.ts` | 256 | `reliable forecast` | False | "reliable forecasts", |
| `src/lib/ragAiOrchestrator.ts` | 257 | `industry benchmark` | False | "below industry benchmark", |
| `src/lib/ragAiOrchestrator.ts` | 258 | `industry benchmark` | False | "industry benchmark", |
| `src/lib/ragAiOrchestrator.ts` | 259 | `directional accuracy` | False | "directional accuracy", |
| `src/lib/ragAiOrchestrator.ts` | 260 | `confidence score` | False | "confidence score", |
| `src/lib/ragAiOrchestrator.ts` | 263 | `production-ready` | False | "production-ready", |
| `src/lib/ragAiOrchestrator.ts` | 265 | `cost savings` | False | "cost savings", |
| `src/lib/ragAiOrchestrator.ts` | 270 | `guarantee` | False | "guarantee", |
| `src/lib/ragAiOrchestrator.ts` | 271 | `guarantee` | False | "guaranteed", |
| `src/lib/ragAiOrchestrator.ts` | 271 | `guaranteed` | False | "guaranteed", |
| `src/lib/ragAiOrchestrator.ts` | 303 | `strong performance` | False | "- Model accuracy or strong performance.", |
| `src/lib/ragAiOrchestrator.ts` | 306 | `causality` | False | "- Causality from Gamma/news context.", |
| `src/lib/ragAiOrchestrator.ts` | 306 | `causal` | False | "- Causality from Gamma/news context.", |
| `src/lib/ragAiOrchestrator.ts` | 307 | `guarantee` | True | "- Guaranteed future gold prices.", |
| `src/lib/ragAiOrchestrator.ts` | 307 | `guaranteed` | True | "- Guaranteed future gold prices.", |
| `src/lib/ragAiOrchestrator.ts` | 324 | `guarantee` | True | "- Forecast paths are model outputs for review, not guaranteed future prices.", |
| `src/lib/ragAiOrchestrator.ts` | 324 | `guaranteed` | True | "- Forecast paths are model outputs for review, not guaranteed future prices.", |
| `src/lib/ragAiOrchestrator.ts` | 325 | `causality` | True | "- Gamma/news context should be treated as interpretive context, not causality.", |
| `src/lib/ragAiOrchestrator.ts` | 325 | `causal` | True | "- Gamma/news context should be treated as interpretive context, not causality.", |
| `src/lib/ragAiOrchestrator.ts` | 328 | `high accuracy` | False | "- High accuracy or strong performance.", |
| `src/lib/ragAiOrchestrator.ts` | 328 | `strong performance` | False | "- High accuracy or strong performance.", |
| `src/lib/ragAiOrchestrator.ts` | 329 | `industry benchmark` | False | "- Industry benchmark comparison.", |
| `src/lib/ragAiOrchestrator.ts` | 330 | `confidence score` | False | "- A confidence score above 95%.", |
| `src/lib/ragAiOrchestrator.ts` | 331 | `directional accuracy` | False | "- Directional accuracy strength.", |
| `src/lib/ragAiOrchestrator.ts` | 332 | `cost savings` | False | "- Cost savings or operational efficiency impact.", |
| `src/lib/ragAiOrchestrator.ts` | 332 | `operational efficiency` | False | "- Cost savings or operational efficiency impact.", |
| `src/lib/ragAiOrchestrator.ts` | 414 | `guarantee` | True | "Forecasts should be described as model outputs, not guarantees. Final claims must come from approved CSV/JSON artifacts." |
| `src/lib/ragAiOrchestrator.ts` | 472 | `langchain` | False | - For architecture, RAG, orchestrator, vector, LangChain, LlamaIndex, SQL-tool, or implementation-status questions, answer from ARCHITECTURE STATUS first. |
| `src/lib/ragAiOrchestrator.ts` | 472 | `llamaindex` | False | - For architecture, RAG, orchestrator, vector, LangChain, LlamaIndex, SQL-tool, or implementation-status questions, answer from ARCHITECTURE STATUS first. |
| `src/lib/ragAiOrchestrator.ts` | 479 | `production-ready` | True | - Do not describe a SQL row as approved, final, production-ready, validated, curated, stakeholder-ready, cutoff-aligned, or decision-making-ready unless those exact claims are present in the supplied SQL rows or loaded a |
| `src/lib/ragAiOrchestrator.ts` | 486 | `guarantee` | True | - Do not claim model accuracy, production approval, causality, validation, or forecast guarantees from SQL rows or vector matches. |
| `src/lib/ragAiOrchestrator.ts` | 486 | `causality` | True | - Do not claim model accuracy, production approval, causality, validation, or forecast guarantees from SQL rows or vector matches. |
| `src/lib/ragAiOrchestrator.ts` | 486 | `causal` | True | - Do not claim model accuracy, production approval, causality, validation, or forecast guarantees from SQL rows or vector matches. |
| `src/lib/ragAiOrchestrator.ts` | 499 | `causality` | True | 3. Do not claim causality. |
| `src/lib/ragAiOrchestrator.ts` | 499 | `causal` | True | 3. Do not claim causality. |
| `src/lib/ragAiOrchestrator.ts` | 500 | `guarantee` | True | 4. Do not say forecasts are guaranteed. |
| `src/lib/ragAiOrchestrator.ts` | 500 | `guaranteed` | True | 4. Do not say forecasts are guaranteed. |
| `src/lib/ragAiOrchestrator.ts` | 588 | `langchain` | False | q.includes("langchain") \|\| |
| `src/lib/ragAiOrchestrator.ts` | 589 | `llamaindex` | False | q.includes("llamaindex") \|\| |
| `src/lib/ragAiOrchestrator.ts` | 667 | `langchain` | False | "LangChain or LlamaIndex orchestration framework", |
| `src/lib/ragAiOrchestrator.ts` | 667 | `llamaindex` | False | "LangChain or LlamaIndex orchestration framework", |
| `src/lib/ragAiOrchestrator.ts` | 668 | `automatic sql tool execution` | False | "automatic SQL tool execution", |
| `src/lib/ragAiOrchestrator.ts` | 669 | `model rerun` | False | "scheduled artifact refresh or model rerun orchestration", |
| `RAG_SQL_VECTOR_DEPLOYMENT_NOTES.md` | 28 | `guarantee` | True | - Forecasts are model outputs for review, not guaranteed future prices. |
| `RAG_SQL_VECTOR_DEPLOYMENT_NOTES.md` | 28 | `guaranteed` | True | - Forecasts are model outputs for review, not guaranteed future prices. |
| `RAG_SQL_VECTOR_DEPLOYMENT_NOTES.md` | 31 | `guarantee` | True | - Vector matches do not prove model accuracy, production approval, causality, or forecast guarantees. |
| `RAG_SQL_VECTOR_DEPLOYMENT_NOTES.md` | 31 | `causality` | True | - Vector matches do not prove model accuracy, production approval, causality, or forecast guarantees. |
| `RAG_SQL_VECTOR_DEPLOYMENT_NOTES.md` | 31 | `causal` | True | - Vector matches do not prove model accuracy, production approval, causality, or forecast guarantees. |
| `RAG_SQL_VECTOR_DEPLOYMENT_NOTES.md` | 33 | `causality` | True | - Gamma/news context is interpretive context, not causality. |
| `RAG_SQL_VECTOR_DEPLOYMENT_NOTES.md` | 33 | `causal` | True | - Gamma/news context is interpretive context, not causality. |
| `RAG_SQL_VECTOR_DEPLOYMENT_NOTES.md` | 34 | `langchain` | True | - LangChain and LlamaIndex are not integrated yet. |
| `RAG_SQL_VECTOR_DEPLOYMENT_NOTES.md` | 34 | `llamaindex` | True | - LangChain and LlamaIndex are not integrated yet. |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 13 | `guarantee` | True | This architecture is designed for project explanation, artifact traceability, and professor-safe AI answers. It does not train forecasting models, rerun models, validate forecasts, refresh artifacts, or guarantee future  |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 63 | `guarantee` | False | > The system guarantees forecast accuracy. |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 87 | `causal` | False | - causal impact |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 89 | `guarantee` | False | - forecast guarantees |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 113 | `causality` | False | - prove causality |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 113 | `causal` | False | - prove causality |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 116 | `guarantee` | False | - guarantee prices |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 147 | `guarantee` | True | > Green actual dots are observed Yahoo/GC=F prices for visual comparison only. They do not alter forecast artifacts, retrain models, validate accuracy, or guarantee future prices. |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 165 | `guarantee` | True | - guaranteed future prices |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 165 | `guaranteed` | True | - guaranteed future prices |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 166 | `high accuracy` | False | - high accuracy |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 167 | `reliable forecast` | False | - reliable forecast |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 168 | `production-ready` | False | - production-ready status |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 169 | `confidence score` | False | - confidence score above 95% |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 170 | `industry benchmark` | False | - industry benchmark comparison |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 171 | `directional accuracy` | False | - directional accuracy strength |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 172 | `cost savings` | False | - cost savings |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 173 | `operational efficiency` | False | - operational efficiency impact |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 174 | `causal` | False | - causal Gamma/news impact |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 192 | `langchain` | True | \| LangChain integration \| Not active yet \| Future framework phase. \| |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 193 | `langchain` | True | \| LlamaIndex integration \| Not active yet \| Optional comparison after LangChain decision. \| |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 193 | `llamaindex` | True | \| LlamaIndex integration \| Not active yet \| Optional comparison after LangChain decision. \| |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 194 | `automatic sql tool execution` | True | \| Automatic SQL tool execution \| Not active yet \| Current SQL is supplied by pages; the orchestrator does not run SQL by itself. \| |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 196 | `model rerun` | True | \| Model rerun/training orchestration \| Not active yet \| The orchestrator does not train, rerun, or validate forecasting models. \| |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 205 | `langchain` | False | 1. `FRAMEWORK-1 - LangChain.js wrapper` |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 206 | `langchain` | False | - Add a thin LangChain.js orchestration wrapper around the existing RAG + SQL + Vector flow. |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 211 | `llamaindex` | False | 2. `FRAMEWORK-2 - Optional LlamaIndex comparison` |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 212 | `llamaindex` | False | - Evaluate whether LlamaIndex adds value for document indexing or retrieval. |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 215 | `auto sql` | False | 3. `TOOLS-1 - Auto SQL tool execution` |
| `RAG_SQL_VECTOR_ARCHITECTURE_EXPLANATION.md` | 221 | `scheduled refresh` | False | 4. `OPS-1 - Scheduled refresh` |

## Final DOC-2 decision

This branch is safe to describe as a completed milestone for RAG + SQL + Vector artifact-grounded AI explanation, while clearly stating that LangChain.js, LlamaIndex, auto SQL tools, scheduled refresh, and model rerun orchestration are future phases.

This branch should still complete FINAL-1 and FINAL-2 before any merge to `main`.