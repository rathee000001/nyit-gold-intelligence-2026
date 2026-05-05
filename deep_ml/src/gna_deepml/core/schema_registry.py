from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from gna_deepml.core.paths import SCHEMAS_ROOT

SCHEMA_FILES = {
    "deep_ml_model_run": "deep_ml_model_run.schema.json",
    "deep_ml_factor_state_table": "factor_state_table.schema.json",
    "deep_ml_mode_status": "deep_ml_mode_status.schema.json",
    "latest_deep_ml_pointer": "latest_deep_ml_pointer.schema.json",
    "deep_ml_ai_context_bundle": "deep_ml_ai_context_bundle.schema.json",
}

def load_json(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))

def load_schema(artifact_type: str) -> dict[str, Any]:
    if artifact_type not in SCHEMA_FILES:
        raise KeyError(f"Unknown artifact_type: {artifact_type}")
    return load_json(SCHEMAS_ROOT / SCHEMA_FILES[artifact_type])

def validate_artifact(artifact: dict[str, Any]) -> list[str]:
    artifact_type = artifact.get("artifact_type")
    if not artifact_type:
        return ["Missing artifact_type"]
    schema = load_schema(artifact_type)
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(artifact), key=lambda e: list(e.path))
    return [f"{list(e.path)}: {e.message}" for e in errors]

def validate_artifact_file(path: str | Path) -> list[str]:
    artifact = load_json(path)
    return validate_artifact(artifact)
