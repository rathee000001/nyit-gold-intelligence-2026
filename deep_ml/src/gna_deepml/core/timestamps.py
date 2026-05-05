from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

LOCAL_TZ = ZoneInfo("America/New_York")

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def local_now_iso() -> str:
    return datetime.now(LOCAL_TZ).replace(microsecond=0).isoformat()

@dataclass(frozen=True)
class TimestampBundle:
    generated_at_utc: str
    generated_at_local: str
    timezone_local: str = "America/New_York"

def build_timestamp_bundle() -> TimestampBundle:
    return TimestampBundle(
        generated_at_utc=utc_now_iso(),
        generated_at_local=local_now_iso(),
    )
