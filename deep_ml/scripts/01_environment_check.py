from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def find_repo_root(start: Path | None = None) -> Path:
    current = (start or Path.cwd()).resolve()
    for parent in [current, *current.parents]:
        if (parent / ".git").exists() or (parent / "package.json").exists():
            return parent
    return current


REPO_ROOT = find_repo_root()
DEEP_ML_ROOT = REPO_ROOT / "deep_ml"
ARTIFACT_ROOT = REPO_ROOT / "artifacts" / "deep_ml"
PUBLIC_ARTIFACT_ROOT = REPO_ROOT / "public" / "artifacts" / "deep_ml"


def run_command(command: list[str], timeout: int = 20) -> dict:
    try:
        completed = subprocess.run(
            command,
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,
        )
        return {
            "ok": completed.returncode == 0,
            "returncode": completed.returncode,
            "stdout": completed.stdout.strip(),
            "stderr": completed.stderr.strip(),
        }
    except FileNotFoundError as exc:
        return {
            "ok": False,
            "returncode": None,
            "stdout": "",
            "stderr": f"Command not found: {exc}",
        }
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "returncode": None,
            "stdout": "",
            "stderr": f"Command timed out after {timeout} seconds.",
        }


def check_python() -> dict:
    in_venv = hasattr(sys, "real_prefix") or sys.prefix != getattr(sys, "base_prefix", sys.prefix)

    return {
        "executable": sys.executable,
        "version": sys.version,
        "version_info": {
            "major": sys.version_info.major,
            "minor": sys.version_info.minor,
            "micro": sys.version_info.micro,
        },
        "in_virtual_environment": in_venv,
        "prefix": sys.prefix,
        "base_prefix": getattr(sys, "base_prefix", None),
        "recommended": "Python 3.11 or 3.12 recommended for this project.",
        "ok": (sys.version_info.major == 3 and sys.version_info.minor in [11, 12]),
    }


def check_paths() -> dict:
    required_paths = {
        "repo_root": REPO_ROOT,
        "deep_ml_root": DEEP_ML_ROOT,
        "deep_ml_scripts": DEEP_ML_ROOT / "scripts",
        "deep_ml_configs": DEEP_ML_ROOT / "configs",
        "deep_ml_contracts": DEEP_ML_ROOT / "contracts",
        "deep_ml_src": DEEP_ML_ROOT / "src",
        "artifact_root": ARTIFACT_ROOT,
        "public_artifact_root": PUBLIC_ARTIFACT_ROOT,
        "schemas_root": DEEP_ML_ROOT / "contracts" / "schemas",
        "examples_root": DEEP_ML_ROOT / "contracts" / "examples",
    }

    results = {}
    all_ok = True

    for key, path in required_paths.items():
        exists = path.exists()
        is_dir = path.is_dir() if exists else False
        results[key] = {
            "path": str(path),
            "exists": exists,
            "is_dir": is_dir,
        }
        if key != "repo_root" and not exists:
            all_ok = False

    return {
        "ok": all_ok,
        "paths": results,
    }


def check_phase0_contracts() -> dict:
    expected_files = [
        DEEP_ML_ROOT / "contracts" / "schemas" / "deep_ml_model_run.schema.json",
        DEEP_ML_ROOT / "contracts" / "schemas" / "factor_state_table.schema.json",
        DEEP_ML_ROOT / "contracts" / "schemas" / "deep_ml_mode_status.schema.json",
        DEEP_ML_ROOT / "contracts" / "schemas" / "latest_deep_ml_pointer.schema.json",
        DEEP_ML_ROOT / "contracts" / "schemas" / "deep_ml_ai_context_bundle.schema.json",
        DEEP_ML_ROOT / "contracts" / "examples" / "sample_model_run.json",
        DEEP_ML_ROOT / "contracts" / "examples" / "sample_factor_state_table.json",
        DEEP_ML_ROOT / "contracts" / "examples" / "sample_mode_status.json",
        DEEP_ML_ROOT / "contracts" / "examples" / "sample_latest_pointer.json",
        DEEP_ML_ROOT / "contracts" / "examples" / "sample_deep_ml_ai_context_bundle.json",
    ]

    files = []
    all_ok = True

    for path in expected_files:
        exists = path.exists()
        files.append({
            "path": str(path.relative_to(REPO_ROOT)) if path.exists() or REPO_ROOT in path.parents else str(path),
            "exists": exists,
        })
        if not exists:
            all_ok = False

    validation_report = ARTIFACT_ROOT / "governance" / "phase0_contract_validation_report.json"

    return {
        "ok": all_ok,
        "phase0_status": "ready" if all_ok else "phase0_missing_or_incomplete",
        "expected_files": files,
        "phase0_validation_report_exists": validation_report.exists(),
        "phase0_validation_report_path": str(validation_report),
    }


def check_git() -> dict:
    git_exists = shutil.which("git") is not None

    result = {
        "git_available": git_exists,
        "ok": git_exists,
        "branch": None,
        "commit": None,
        "status_short": None,
        "remote": None,
    }

    if not git_exists:
        return result

    branch = run_command(["git", "branch", "--show-current"])
    commit = run_command(["git", "rev-parse", "--short", "HEAD"])
    status = run_command(["git", "status", "--short"])
    remote = run_command(["git", "remote", "-v"])

    result.update({
        "branch": branch["stdout"] if branch["ok"] else None,
        "commit": commit["stdout"] if commit["ok"] else None,
        "status_short": status["stdout"],
        "remote": remote["stdout"],
        "commands": {
            "branch": branch,
            "commit": commit,
            "status": status,
            "remote": remote,
        }
    })

    return result


def check_node_frontend_context() -> dict:
    package_json = REPO_ROOT / "package.json"
    next_config = REPO_ROOT / "next.config.ts"
    src_dir = REPO_ROOT / "src"

    return {
        "package_json_exists": package_json.exists(),
        "next_config_exists": next_config.exists(),
        "src_dir_exists": src_dir.exists(),
        "note": "Frontend is checked only for context. Phase 1 does not modify frontend.",
        "ok": package_json.exists() and src_dir.exists(),
    }


def check_artifact_writable() -> dict:
    paths = [
        ARTIFACT_ROOT / "governance",
        PUBLIC_ARTIFACT_ROOT / "governance",
    ]

    results = []
    all_ok = True

    for path in paths:
        try:
            path.mkdir(parents=True, exist_ok=True)
            test_file = path / ".write_test"
            test_file.write_text("ok", encoding="utf-8")
            test_file.unlink(missing_ok=True)
            results.append({
                "path": str(path),
                "writable": True,
                "error": None,
            })
        except Exception as exc:
            all_ok = False
            results.append({
                "path": str(path),
                "writable": False,
                "error": str(exc),
            })

    return {
        "ok": all_ok,
        "results": results,
    }


def check_torch_cuda() -> dict:
    result = {
        "torch_installed": False,
        "torch_version": None,
        "cuda_available": False,
        "cuda_version": None,
        "device_count": 0,
        "devices": [],
        "ok": False,
        "note": "Torch is optional in Phase 1, but required before Beta/Delta deep models."
    }

    try:
        import torch  # type: ignore
    except Exception as exc:
        result["import_error"] = str(exc)
        return result

    result["torch_installed"] = True
    result["torch_version"] = getattr(torch, "__version__", None)
    result["cuda_available"] = bool(torch.cuda.is_available())
    result["cuda_version"] = getattr(torch.version, "cuda", None)
    result["device_count"] = int(torch.cuda.device_count()) if result["cuda_available"] else 0

    devices = []
    if result["cuda_available"]:
        for idx in range(torch.cuda.device_count()):
            props = torch.cuda.get_device_properties(idx)
            devices.append({
                "index": idx,
                "name": torch.cuda.get_device_name(idx),
                "total_memory_gb": round(props.total_memory / (1024 ** 3), 2),
                "major": props.major,
                "minor": props.minor,
            })

    result["devices"] = devices
    result["ok"] = result["torch_installed"]
    return result


def check_nvidia_smi() -> dict:
    if shutil.which("nvidia-smi") is None:
        return {
            "available": False,
            "ok": False,
            "stdout": "",
            "stderr": "nvidia-smi not found in PATH. This may still be okay if PyTorch detects CUDA later.",
        }

    result = run_command(["nvidia-smi"], timeout=20)

    return {
        "available": result["ok"],
        "ok": result["ok"],
        "stdout": result["stdout"],
        "stderr": result["stderr"],
    }


def check_env_vars() -> dict:
    keys = [
        "OPENROUTER_API_KEY",
        "NEWS_API_KEY",
        "GOLD_API_PROVIDER",
        "GOLD_API_SYMBOL",
        "DEEPML_MODE",
    ]

    return {
        key: {
            "present": bool(os.environ.get(key)),
            "value_preview": "***set***" if os.environ.get(key) else None,
        }
        for key in keys
    }


def decide_status(report: dict) -> tuple[str, list[str]]:
    blockers = []
    warnings = []

    if not report["paths"]["ok"]:
        blockers.append("Deep ML folder structure is incomplete. Phase 0 may not have been fully created.")

    if not report["phase0_contracts"]["ok"]:
        blockers.append("Phase 0 contract schemas/examples are missing or incomplete.")

    if not report["python"]["in_virtual_environment"]:
        warnings.append("Python is not running inside a virtual environment.")

    if not report["python"]["ok"]:
        warnings.append("Python version is not 3.11 or 3.12. It may still work, but 3.11/3.12 is recommended.")

    if not report["git"]["git_available"]:
        warnings.append("Git is not available in PATH.")

    if not report["artifact_writable"]["ok"]:
        blockers.append("Artifact folders are not writable.")

    if not report["torch_cuda"]["torch_installed"]:
        warnings.append("PyTorch is not installed yet. This is okay for Phase 1 but must be fixed before deep models.")

    if report["torch_cuda"]["torch_installed"] and not report["torch_cuda"]["cuda_available"]:
        warnings.append("PyTorch is installed but CUDA is not available. Deep models may run on CPU unless CUDA install is fixed.")

    if blockers:
        return "blocked", blockers + warnings

    if warnings:
        return "ready_with_warnings", warnings

    return "ready", []


def main() -> int:
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    PUBLIC_ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)

    report = {
        "artifact_type": "deep_ml_environment_report",
        "schema_version": "1.0.0",
        "generated_at_utc": utc_now_iso(),
        "phase": "phase_1_local_runtime_foundation",
        "repo_root": str(REPO_ROOT),
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
        },
        "python": check_python(),
        "paths": check_paths(),
        "phase0_contracts": check_phase0_contracts(),
        "git": check_git(),
        "frontend_context": check_node_frontend_context(),
        "artifact_writable": check_artifact_writable(),
        "nvidia_smi": check_nvidia_smi(),
        "torch_cuda": check_torch_cuda(),
        "environment_variables": check_env_vars(),
    }

    status, notes = decide_status(report)
    report["status"] = status
    report["notes"] = notes
    report["next_step"] = (
        "Proceed to Phase 2 cutoff/data governance only if status is ready or ready_with_warnings."
        if status != "blocked"
        else "Fix blockers first. Usually this means rerun Phase 0 contract setup."
    )

    out1 = ARTIFACT_ROOT / "governance" / "environment_report.json"
    out2 = PUBLIC_ARTIFACT_ROOT / "governance" / "environment_report.json"

    out1.parent.mkdir(parents=True, exist_ok=True)
    out2.parent.mkdir(parents=True, exist_ok=True)

    out1.write_text(json.dumps(report, indent=2), encoding="utf-8")
    out2.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    print()
    print(f"WROTE: {out1}")
    print(f"WROTE: {out2}")

    return 0 if status in ["ready", "ready_with_warnings"] else 1


if __name__ == "__main__":
    raise SystemExit(main())