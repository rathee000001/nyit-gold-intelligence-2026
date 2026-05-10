import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

MANIFEST = Path("public/artifacts/vector/gold_artifact_vector_manifest.json")


def require_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def post_json(url, token, payload, timeout=60):
    body = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        text = response.read().decode("utf-8", errors="replace")
        return response.status, text


def load_manifest(limit=0):
    if not MANIFEST.exists():
        raise RuntimeError(f"Missing manifest: {MANIFEST}. Run scripts/build_upstash_vector_artifact_index.py first.")

    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    records = payload.get("records", [])

    if not isinstance(records, list):
        raise RuntimeError("Manifest records must be a list.")

    if limit and limit > 0:
        records = records[:limit]

    return payload, records


def make_upsert_payload(records):
    # Upstash Vector built-in embedding indexes use /upsert-data.
    # The endpoint accepts text data records and creates embeddings server-side.
    return [
        {
            "id": record["id"],
            "data": record["data"],
            "metadata": record.get("metadata", {}),
        }
        for record in records
    ]


def upload_records(records, batch_size):
    rest_url = require_env("UPSTASH_VECTOR_REST_URL").rstrip("/")
    rest_token = require_env("UPSTASH_VECTOR_REST_TOKEN")
    upsert_path = os.environ.get("UPSTASH_VECTOR_UPSERT_PATH", "/upsert-data")
    endpoint = f"{rest_url}{upsert_path}"

    uploaded = 0

    for start in range(0, len(records), batch_size):
        batch = records[start : start + batch_size]
        payload = make_upsert_payload(batch)

        try:
            status, text = post_json(endpoint, rest_token, payload)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            print(f"Upload failed at batch starting {start}: HTTP {exc.code}")
            print(detail[:1800])
            raise

        uploaded += len(batch)
        print(f"Uploaded batch {start // batch_size + 1}: HTTP {status}, records={len(batch)}, total={uploaded}")

        if text:
            print(text[:500])

        time.sleep(0.15)

    return uploaded


def query_test(question):
    rest_url = require_env("UPSTASH_VECTOR_REST_URL").rstrip("/")
    rest_token = require_env("UPSTASH_VECTOR_REST_TOKEN")
    query_path = os.environ.get("UPSTASH_VECTOR_QUERY_PATH", "/query-data")
    endpoint = f"{rest_url}{query_path}"

    payload = {
        "data": question,
        "topK": 5,
        "includeMetadata": True,
        "includeVectors": False,
    }

    status, text = post_json(endpoint, rest_token, payload)
    print(f"Query test HTTP {status}")
    print(text[:2500])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Only upload the first N records.")
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--query", default="", help="Run a vector query after upload/check.")
    args = parser.parse_args()

    manifest, records = load_manifest(args.limit)

    print("VECTOR-2C Upstash manifest upload utility")
    print(f"Manifest: {MANIFEST}")
    print(f"Manifest recordCount: {manifest.get('recordCount')}")
    print(f"Selected records: {len(records)}")
    print("Safety: records are retrieval context only and do not alter forecasts, models, or artifacts.")

    if args.upload:
        uploaded = upload_records(records, args.batch_size)
        print(f"Upload complete. Uploaded records: {uploaded}")
    else:
        print("Upload not requested. Add --upload to send records to Upstash.")

    if args.query:
        query_test(args.query)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"VECTOR-2C failed: {exc}")
        sys.exit(2)
