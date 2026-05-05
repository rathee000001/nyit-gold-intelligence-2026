from __future__ import annotations

import json
import sys
from pathlib import Path

# Make local package importable without installing editable package yet.
REPO_ROOT = Path(__file__).resolve().parents[2]
SRC_ROOT = REPO_ROOT / "deep_ml" / "src"
sys.path.insert(0, str(SRC_ROOT))

from gna_deepml.core.schema_registry import validate_artifact_file
from gna_deepml.core.timestamps import utc_now_iso

EXAMPLES = [
    "deep_ml/contracts/examples/sample_model_run.json",
    "deep_ml/contracts/examples/sample_factor_state_table.json",
    "deep_ml/contracts/examples/sample_mode_status.json",
    "deep_ml/contracts/examples/sample_latest_pointer.json",
    "deep_ml/contracts/examples/sample_deep_ml_ai_context_bundle.json",
]

def main() -> int:
    results = []
    all_ok = True

    for rel in EXAMPLES:
        path = REPO_ROOT / rel
        errors = validate_artifact_file(path)
        ok = len(errors) == 0
        all_ok = all_ok and ok
        results.append({
            "artifact": rel,
            "ok": ok,
            "errors": errors
        })

    report = {
        "artifact_type": "phase0_contract_validation_report",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "status": "passed" if all_ok else "failed",
        "results": results
    }

    out_path = REPO_ROOT / "artifacts" / "deep_ml" / "governance" / "phase0_contract_validation_report.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    public_out_path = REPO_ROOT / "public" / "artifacts" / "deep_ml" / "governance" / "phase0_contract_validation_report.json"
    public_out_path.parent.mkdir(parents=True, exist_ok=True)
    public_out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    return 0 if all_ok else 1

if __name__ == "__main__":
    raise SystemExit(main())
