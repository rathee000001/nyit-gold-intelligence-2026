from pathlib import Path

def find_repo_root(start: Path | None = None) -> Path:
    current = (start or Path.cwd()).resolve()
    for parent in [current, *current.parents]:
        if (parent / "package.json").exists() or (parent / ".git").exists():
            return parent
    return current

REPO_ROOT = find_repo_root()

DEEP_ML_ROOT = REPO_ROOT / "deep_ml"
CONTRACTS_ROOT = DEEP_ML_ROOT / "contracts"
SCHEMAS_ROOT = CONTRACTS_ROOT / "schemas"
EXAMPLES_ROOT = CONTRACTS_ROOT / "examples"

ARTIFACT_ROOT = REPO_ROOT / "artifacts" / "deep_ml"
PUBLIC_ARTIFACT_ROOT = REPO_ROOT / "public" / "artifacts" / "deep_ml"
