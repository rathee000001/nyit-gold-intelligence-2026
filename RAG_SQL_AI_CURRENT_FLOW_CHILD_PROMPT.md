You are reviewing my Gold Nexus Alpha repo to understand the current AI workflow before we patch anything.

IMPORTANT:
Work only on branch feature/rag-sql-ai-orchestrator.
Do not touch main.
Do not change Vercel config.
Do not rewrite full pages.
Do not break current artifact loading.
Use minimal patch updates only.

Current project context:
- Gold Nexus Alpha is an artifact-first forecasting platform.
- Artifacts are CSV/JSON outputs from academic models, Deep ML models, data matrix refresh, Gamma, Omega, final evaluation, governance, and feature store.
- Current AI uses a blob/artifact system.
- Gold AI Studio, floating Gold AI, Data Matrix AI, and Final Deep ML Eval AI are already page-aware or artifact-aware.
- Current AI should be treated as Level 1 Artifact Blob AI.
- New goal is to introduce Level 2 RAG + SQL AI Orchestrator.
- RAG retrieval must happen before LLM generation.
- The final RAG AI should become the shared intelligence layer powering:
  1. Floating Gold AI House
  2. Gold AI Studio
  3. Data Matrix AI
  4. Final Deep ML Eval AI
  5. Page-aware model AI on Alpha/Beta/Delta/Epsilon/Gamma/Omega pages

Professor discussion context:
- Need to explain LLM model, orchestration, vector database/vector index, artifact retrieval, and future LangChain/LlamaIndex possibility.
- Current system should be described honestly as artifact-grounded RAG-style AI.
- Do not claim full vector database unless we implement one.
- A low-risk first upgrade can be generated vector/index retrieval over artifact summaries, not external vector DB.

Inspect these files first:
- package.json
- src/app/api/gold-ai/route.ts
- src/lib/goldArtifactBlobService.ts
- src/lib/goldArtifactBlobCatalog.generated.ts if it exists
- src/app/api/artifact-blob/route.ts
- src/components/interpreter/FloatingGoldInterpreter.tsx
- src/app/gold-ai/page.tsx
- src/app/data-matrix/page.tsx
- src/app/deep-ml/models/final-deep-ml-evaluation/page.tsx
- src/app/deep-ml/models/alpha-structural/page.tsx
- src/app/deep-ml/models/beta-temporal/page.tsx
- src/app/deep-ml/models/delta-tft/page.tsx
- src/app/deep-ml/models/epsilon-ensemble/page.tsx
- src/app/deep-ml/models/gamma-news-sensitivity/page.tsx
- src/app/deep-ml/models/omega-fusion/page.tsx
- src/app/model-comparison/page.tsx

Return:
1. Current AI workflow from UI to API to artifact retrieval to LLM.
2. Which components currently call /api/gold-ai.
3. How current blob retrieval works.
4. Whether current AI is true RAG, RAG-style, or not RAG.
5. Safest way to upgrade current AI into Level 2 RAG AI.
6. Where SQL can be introduced:
   - Data Matrix SQL
   - Blob Catalog SQL
   - Gold AI SQL helper
   - Final Deep ML Eval SQL
   - Model Comparison SQL
   - Gamma/News SQL
7. Exact Phase 1 patch only.
8. Exact files to touch in Phase 1.
9. Exact files not to touch.
10. Build/test commands.
11. LinkedIn-safe wording after upgrade.
12. Professor-safe architecture wording.