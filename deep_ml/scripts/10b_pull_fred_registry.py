"""
Gold Nexus Alpha — Deep ML Phase 10B V2
FRED Registry Pull Patch

Script path expected:
    deep_ml/scripts/10b_pull_fred_registry.py

Purpose:
    Pull approved FRED/API factor registry into local CSV artifacts so Phase 11
    can merge post-cutoff FRED values into the refreshed feature store.

Important V2 changes:
    - Default pull starts at 2025-01-01, not only 2026-04-01.
      This allows monthly/lagged FRED releases to be forward-filled after cutoff.
    - Retries temporary FRED HTTP 500 / network errors.
    - Keeps the exact registry IDs provided by the project registry.
    - Does not write FRED_API_KEY into any artifact.

Input registry:
    artifacts/deep_ml/source_inputs/fred_series_registry.json

Output folder:
    artifacts/deep_ml/source_update/fred_pulled_series/

Review artifact:
    artifacts/deep_ml/source_update/fred_registry_pull_report.json

Windows / PowerShell commands:
    code .\deep_ml\scripts\10b_pull_fred_registry.py
    py .\deep_ml\scripts\10b_pull_fred_registry.py --smoke
    py .\deep_ml\scripts\10b_pull_fred_registry.py

Required .env.local:
    FRED_API_KEY=your_key_here
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import platform
import subprocess
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from tqdm.auto import tqdm
except Exception:  # pragma: no cover
    tqdm = None


SCRIPT_VERSION = "fred_registry_pull_v2_retry_long_window"
PHASE_KEY = "phase10b_fred_registry_pull"
FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations"
FRED_SERIES_URL = "https://api.stlouisfed.org/fred/series"
DEFAULT_START = "2025-01-01"
DEFAULT_REGISTRY = "artifacts/deep_ml/source_inputs/fred_series_registry.json"
DEFAULT_OUTPUT_DIR = "artifacts/deep_ml/source_update/fred_pulled_series"
DEFAULT_REPORT = "artifacts/deep_ml/source_update/fred_registry_pull_report.json"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(dt: Optional[datetime] = None) -> str:
    return (dt or utc_now()).isoformat().replace("+00:00", "Z")


def stable_hash_file(path: Path) -> str:
    if not path.exists() or not path.is_file():
        return "missing"
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def write_csv_dicts(path: Path, rows: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    keys: List[str] = []
    for row in rows:
        for key in row.keys():
            if key not in keys:
                keys.append(key)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k) for k in keys})


def safe_float(x: Any) -> Optional[float]:
    try:
        if x is None:
            return None
        val = float(x)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    except Exception:
        return None


def detect_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (candidate / ".git").exists() or (candidate / "artifacts").exists() or (candidate / "deep_ml").exists():
            return candidate
    return current


def get_git_commit(repo_root: Path) -> Optional[str]:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(repo_root),
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return None


def load_env(repo_root: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    for name in [".env.local", ".env", "deep_ml/.env", "deep_ml/.env.local"]:
        path = repo_root / name
        if not path.exists():
            continue
        try:
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
        except Exception:
            pass
    for k, v in os.environ.items():
        env[k] = v
    return env


def http_get_json_with_retry(url: str, timeout: int = 30, retries: int = 3, sleep_seconds: float = 1.5) -> Dict[str, Any]:
    last_error: Optional[BaseException] = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "GoldNexusAlphaDeepML/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last_error = exc
            # Retry temporary server/rate issues; fail fast for bad requests/auth.
            if exc.code not in {429, 500, 502, 503, 504} or attempt == retries:
                raise
            time.sleep(sleep_seconds * attempt)
        except Exception as exc:
            last_error = exc
            if attempt == retries:
                raise
            time.sleep(sleep_seconds * attempt)
    raise RuntimeError(f"HTTP JSON request failed after retries: {last_error}")


def fred_get_observations(series_id: str, api_key: str, start: str, end: Optional[str], timeout: int, retries: int) -> List[Dict[str, Any]]:
    params = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "observation_start": start,
    }
    if end:
        params["observation_end"] = end
    url = FRED_OBSERVATIONS_URL + "?" + urllib.parse.urlencode(params)
    payload = http_get_json_with_retry(url, timeout=timeout, retries=retries)
    return payload.get("observations", []) if isinstance(payload, dict) else []


def fred_get_meta(series_id: str, api_key: str, timeout: int, retries: int) -> Dict[str, Any]:
    params = {"series_id": series_id, "api_key": api_key, "file_type": "json"}
    try:
        payload = http_get_json_with_retry(FRED_SERIES_URL + "?" + urllib.parse.urlencode(params), timeout=timeout, retries=retries)
        return (payload.get("seriess") or [{}])[0]
    except Exception:
        return {}


def normalize_registry(registry: Any) -> List[Dict[str, Any]]:
    if isinstance(registry, dict):
        series = registry.get("series", [])
    elif isinstance(registry, list):
        series = registry
    else:
        series = []

    out: List[Dict[str, Any]] = []
    seen = set()
    for item in series:
        if not isinstance(item, dict):
            continue
        sid = str(item.get("series_id") or item.get("fred_series_id") or "").strip()
        factor_key = str(item.get("factor_key") or sid.lower()).strip()
        if not sid or sid in seen:
            continue
        seen.add(sid)
        out.append(
            {
                "factor_key": factor_key,
                "series_id": sid,
                "target_columns": item.get("target_columns") or [factor_key],
                "frequency_handling": item.get("frequency_handling") or "forward_fill_to_business_days",
                "source_role": item.get("source_role") or "fred_api_factor",
                "official_core": bool(item.get("official_core", True)),
                "model_policy": item.get("model_policy") or "include_if_column_exists_and_not_excluded",
                "notes": item.get("notes"),
            }
        )
    return out


def pull_one(
    entry: Dict[str, Any],
    api_key: str,
    out_dir: Path,
    start: str,
    end: Optional[str],
    timeout: int,
    retries: int,
) -> Dict[str, Any]:
    series_id = entry["series_id"]
    started = time.time()
    try:
        observations = fred_get_observations(series_id, api_key, start, end, timeout, retries)
        meta = fred_get_meta(series_id, api_key, timeout, retries)
        rows: List[Dict[str, Any]] = []
        for obs in observations:
            value_raw = obs.get("value")
            value = safe_float(value_raw)
            rows.append(
                {
                    "date": obs.get("date"),
                    "value": value,
                    "value_raw": value_raw,
                    "series_id": series_id,
                    "factor_key": entry.get("factor_key"),
                    "target_columns": "|".join(entry.get("target_columns") or []),
                    "frequency_handling": entry.get("frequency_handling"),
                    "source_role": entry.get("source_role"),
                    "official_core": entry.get("official_core"),
                    "model_policy": entry.get("model_policy"),
                    "pulled_at_utc": iso_utc(),
                }
            )
        csv_path = out_dir / f"fred_{series_id}.csv"
        write_csv_dicts(csv_path, rows)
        valid_dates = [r["date"] for r in rows if r.get("date") and r.get("value") is not None]
        return {
            "factor_key": entry.get("factor_key"),
            "series_id": series_id,
            "target_columns": entry.get("target_columns"),
            "frequency_handling": entry.get("frequency_handling"),
            "source_role": entry.get("source_role"),
            "official_core": entry.get("official_core"),
            "model_policy": entry.get("model_policy"),
            "status": "pulled",
            "observation_count": len(rows),
            "valid_observation_count": len(valid_dates),
            "first_valid_date": min(valid_dates) if valid_dates else None,
            "last_valid_date": max(valid_dates) if valid_dates else None,
            "title": meta.get("title"),
            "frequency": meta.get("frequency"),
            "units": meta.get("units"),
            "output_csv": str(csv_path),
            "output_csv_hash": stable_hash_file(csv_path),
            "runtime_seconds": round(time.time() - started, 3),
        }
    except Exception as exc:
        return {
            "factor_key": entry.get("factor_key"),
            "series_id": series_id,
            "target_columns": entry.get("target_columns"),
            "frequency_handling": entry.get("frequency_handling"),
            "source_role": entry.get("source_role"),
            "official_core": entry.get("official_core"),
            "model_policy": entry.get("model_policy"),
            "status": "failed",
            "error": repr(exc),
            "runtime_seconds": round(time.time() - started, 3),
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Pull approved FRED registry factors for Deep ML refresh.")
    parser.add_argument("--repo-root", type=str, default=None)
    parser.add_argument("--registry", type=str, default=DEFAULT_REGISTRY)
    parser.add_argument("--start", type=str, default=DEFAULT_START)
    parser.add_argument("--end", type=str, default=None)
    parser.add_argument("--max-series", type=int, default=None)
    parser.add_argument("--http-timeout", type=int, default=30)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--smoke", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.smoke and args.max_series is None:
        args.max_series = 3

    repo_root = Path(args.repo_root).resolve() if args.repo_root else detect_repo_root(Path.cwd())
    registry_path = repo_root / args.registry
    out_dir = repo_root / DEFAULT_OUTPUT_DIR
    report_path = repo_root / DEFAULT_REPORT
    source_update_dir = report_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    source_update_dir.mkdir(parents=True, exist_ok=True)
    started = utc_now()
    run_id = f"fred_registry_pull_{started.strftime('%Y%m%d_%H%M%S')}"

    try:
        env = load_env(repo_root)
        api_key = env.get("FRED_API_KEY")
        registry = read_json(registry_path, default=None)
        entries = normalize_registry(registry)
        original_entry_count = len(entries)
        if args.max_series is not None:
            entries = entries[: args.max_series]

        if not registry_path.exists():
            raise FileNotFoundError(f"Missing registry: {registry_path}")
        if not entries:
            raise RuntimeError("FRED registry exists but contains no usable series entries.")
        if not api_key:
            raise RuntimeError("FRED_API_KEY missing. Add it to .env.local or environment before running.")

        rows: List[Dict[str, Any]] = []
        iterator = entries
        if tqdm is not None:
            iterator = tqdm(entries, desc="FRED registry pull", leave=False)
        for entry in iterator:
            row = pull_one(entry, api_key, out_dir, args.start, args.end, args.http_timeout, args.retries)
            if row.get("output_csv"):
                try:
                    row["output_csv"] = str(Path(row["output_csv"]).resolve().relative_to(repo_root))
                except Exception:
                    pass
            rows.append(row)
            write_csv_dicts(source_update_dir / "fred_registry_pull_log.csv", rows)

        pulled = [r for r in rows if r.get("status") == "pulled"]
        failed = [r for r in rows if r.get("status") == "failed"]
        valid_pulled = [r for r in pulled if int(r.get("valid_observation_count") or 0) > 0]
        zero_valid = [r for r in pulled if int(r.get("valid_observation_count") or 0) == 0]
        latest_dates = [r.get("last_valid_date") for r in valid_pulled if r.get("last_valid_date")]

        warnings = []
        if failed:
            warnings.append("Some FRED series failed after retries; see failed_series.")
        if zero_valid:
            warnings.append("Some FRED series pulled but had zero valid observations in the requested window; Phase 11 should carry those forward.")

        report = {
            "artifact_type": "fred_registry_pull_report",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "run_id": run_id,
            "status": "ready_quality_review_required" if warnings else "ready",
            "script_version": SCRIPT_VERSION,
            "git_commit_sha": get_git_commit(repo_root),
            "python_version": sys.version,
            "platform": platform.platform(),
            "registry_path": str(registry_path.relative_to(repo_root)),
            "registry_hash": stable_hash_file(registry_path),
            "fred_api_key_status": "present_redacted",
            "observation_start": args.start,
            "observation_end": args.end,
            "retry_policy": {
                "retries": args.retries,
                "http_timeout_seconds": args.http_timeout,
                "retry_status_codes": [429, 500, 502, 503, 504]
            },
            "series_in_registry": original_entry_count,
            "series_attempted": len(entries),
            "series_pulled": len(pulled),
            "series_valid_pulled": len(valid_pulled),
            "series_zero_valid_observations": len(zero_valid),
            "series_failed": len(failed),
            "latest_valid_observation_date": max(latest_dates) if latest_dates else None,
            "pulled_series": pulled,
            "valid_pulled_series": valid_pulled,
            "zero_valid_series": zero_valid,
            "failed_series": failed,
            "output_folder": str(out_dir.relative_to(repo_root)),
            "quality_review": {
                "blocking_flags": [],
                "warnings": warnings,
                "api_key_not_written_into_artifacts": True,
                "registry_used": True,
                "fred_csv_exports_created": bool(pulled),
                "long_window_enabled_for_monthly_forward_fill": args.start <= "2025-01-01",
            },
            "next_step": {
                "script": "deep_ml/scripts/11_governed_feature_store_refresh.py",
                "instruction": "Patch/run Phase 11 V2 to merge valid pulled FRED CSVs after the official cutoff before rerunning models.",
            },
            "generated_at_utc": iso_utc(),
        }
        write_json(report_path, report)
        print("\n" + "=" * 88)
        print("FRED REGISTRY PULL V2 COMPLETE")
        print("Review this JSON:")
        print("artifacts/deep_ml/source_update/fred_registry_pull_report.json")
        print("=" * 88 + "\n")
    except Exception as exc:
        report = {
            "artifact_type": "fred_registry_pull_report",
            "schema_version": "1.0.0",
            "phase_key": PHASE_KEY,
            "run_id": run_id,
            "status": "failed",
            "error": repr(exc),
            "traceback": traceback.format_exc(),
            "generated_at_utc": iso_utc(),
        }
        write_json(report_path, report)
        print("\nFRED REGISTRY PULL V2 FAILED. Review:")
        print("artifacts/deep_ml/source_update/fred_registry_pull_report.json")
        raise


if __name__ == "__main__":
    main()
