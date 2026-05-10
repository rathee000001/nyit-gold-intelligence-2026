import csv
import json
import re
from pathlib import Path

CATALOG_TS = Path("src/lib/goldArtifactBlobCatalog.generated.ts")
PUBLIC_ROOT = Path("public")
OUT_DIR = Path("public/artifacts/vector")
OUT_FILE = OUT_DIR / "gold_artifact_vector_manifest.json"

MAX_PREVIEW_CHARS = 3000
MAX_PREVIEW_ROWS = 6


def extract_catalog_array(text: str) -> str:
    marker = "GENERATED_ARTIFACT_BLOB_CATALOG"
    marker_index = text.find(marker)
    if marker_index == -1:
        raise RuntimeError("GENERATED_ARTIFACT_BLOB_CATALOG marker not found.")

    equals_index = text.find("=", marker_index)
    if equals_index == -1:
        raise RuntimeError("Catalog assignment '=' not found.")

    start = text.find("[", equals_index)
    if start == -1:
        raise RuntimeError("Catalog array '[' not found.")

    depth = 0
    in_string = False
    quote = ""
    escaped = False

    for index in range(start, len(text)):
        ch = text[index]

        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                in_string = False
                quote = ""
            continue

        if ch in {"'", '"'}:
            in_string = True
            quote = ch
            continue

        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]

    raise RuntimeError("Catalog array closing ']' not found.")


def load_catalog():
    if not CATALOG_TS.exists():
        raise RuntimeError(f"Missing catalog file: {CATALOG_TS}")

    text = CATALOG_TS.read_text(encoding="utf-8", errors="replace")
    array_literal = extract_catalog_array(text)

    try:
        return json.loads(array_literal)
    except json.JSONDecodeError as exc:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        debug = OUT_DIR / "catalog_parse_debug.txt"
        debug.write_text(array_literal[:20000], encoding="utf-8")
        raise RuntimeError(f"Could not parse catalog JSON: {exc}. Debug written to {debug}")


def artifact_disk_path(item):
    public_path = str(item.get("publicPath") or "").lstrip("/")
    if public_path:
        return PUBLIC_ROOT / public_path

    path = str(item.get("path") or "").lstrip("/")
    return PUBLIC_ROOT / "artifacts" / path


def preview_json(path: Path) -> str:
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except Exception as exc:
        return f"JSON preview unavailable: {exc}"

    def simplify(value, depth=0):
        if depth > 3:
            return "[nested]"
        if isinstance(value, dict):
            return {str(k): simplify(v, depth + 1) for k, v in list(value.items())[:24]}
        if isinstance(value, list):
            return [simplify(v, depth + 1) for v in value[:MAX_PREVIEW_ROWS]]
        return value

    return json.dumps(simplify(data), indent=2, ensure_ascii=True)[:MAX_PREVIEW_CHARS]


def preview_csv(path: Path) -> str:
    try:
        rows = []
        with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
            reader = csv.reader(f)
            for index, row in enumerate(reader):
                rows.append(row)
                if index >= MAX_PREVIEW_ROWS:
                    break
        return "\n".join(",".join(str(cell) for cell in row) for row in rows)[:MAX_PREVIEW_CHARS]
    except Exception as exc:
        return f"CSV preview unavailable: {exc}"


def preview_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")[:MAX_PREVIEW_CHARS]
    except Exception as exc:
        return f"Text preview unavailable: {exc}"


def preview_for(item):
    path = artifact_disk_path(item)
    if not path.exists():
        return "Artifact file not found in public/artifacts."

    ext = str(item.get("ext") or path.suffix).lower()
    if ext == ".json":
        return preview_json(path)
    if ext == ".csv":
        return preview_csv(path)
    if ext in {".txt", ".md"}:
        return preview_text(path)

    return f"Preview skipped for extension: {ext}"


def safe_boundaries(item):
    label = str(item.get("label") or "")
    path = str(item.get("path") or "")
    tags = " ".join(str(tag) for tag in item.get("tags") or [])
    lower = f"{label} {path} {tags}".lower()

    rules = [
        "Use as retrieval context for approved Gold Nexus Alpha artifacts only.",
        "Do not infer model accuracy, production approval, causality, or forecast guarantees from metadata alone.",
    ]

    if "forecast" in lower:
        rules.append("Forecast paths are model outputs for review, not guaranteed future prices.")
    if "gamma" in lower or "news" in lower:
        rules.append("Gamma/news context is interpretive and not causal by itself.")
    if "governance" in lower or "quality" in lower or "status" in lower:
        rules.append("Governance/status claims should be quoted from artifact content.")

    return rules


def build_record(item):
    label = str(item.get("label") or item.get("id") or "Untitled artifact")
    artifact_id = str(item.get("id") or re.sub(r"[^a-zA-Z0-9_]+", "_", label.lower()))
    rules = safe_boundaries(item)

    metadata = {
        "id": artifact_id,
        "label": label,
        "path": item.get("path") or "",
        "publicPath": item.get("publicPath") or "",
        "group": item.get("group") or "",
        "domain": item.get("domain") or "",
        "modelKey": item.get("modelKey") or "",
        "ext": item.get("ext") or "",
        "sizeBytes": item.get("sizeBytes") or 0,
        "tags": item.get("tags") if isinstance(item.get("tags"), list) else [],
        "safeBoundaries": rules,
        "professorSafe": True,
    }

    data = "\n".join(
        [
            f"Artifact label: {label}",
            f"Artifact path: {metadata['path']}",
            f"Public path: {metadata['publicPath']}",
            f"Group: {metadata['group']}",
            f"Domain: {metadata['domain']}",
            f"Model key: {metadata['modelKey']}",
            f"Extension: {metadata['ext']}",
            f"Tags: {', '.join(str(tag) for tag in metadata['tags'])}",
            "",
            "Safe claim boundaries:",
            *[f"- {rule}" for rule in rules],
            "",
            "Preview:",
            preview_for(item),
        ]
    )

    return {
        "id": artifact_id,
        "data": data[:5200],
        "metadata": metadata,
    }


def main():
    limit = 0
    args = list(__import__("sys").argv[1:])
    if "--limit" in args:
        idx = args.index("--limit")
        if idx + 1 < len(args):
            limit = int(args[idx + 1])

    catalog = load_catalog()
    if limit > 0:
        catalog = catalog[:limit]

    records = [build_record(item) for item in catalog]

    manifest = {
        "artifactType": "gold_artifact_vector_manifest",
        "schemaVersion": "1.0.0",
        "providerTarget": "upstash_vector",
        "recordCount": len(records),
        "notes": [
            "Generated from approved artifact catalog metadata and previews.",
            "Vector records are retrieval context only.",
            "Do not infer model accuracy, causality, production approval, or forecast guarantees from vector metadata alone.",
        ],
        "records": records,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(manifest, indent=2, ensure_ascii=True), encoding="utf-8")

    print("VECTOR-2B manifest built.")
    print(f"Output: {OUT_FILE}")
    print(f"Records: {len(records)}")
    if records:
        print("First record preview:")
        print(json.dumps(records[0], indent=2, ensure_ascii=True)[:1200])


if __name__ == "__main__":
    main()