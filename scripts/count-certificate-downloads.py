#!/usr/bin/env python3
"""
Count certificate downloads from S3 server access logs.

Downloads are fetched straight from S3 through a presigned URL and never reach the
app, so the access logs are the only record of them. Logging writes to
s3://guinessrecord-access-logs/guinessrecord/; delivery is best-effort and can lag
by minutes to hours, so a count taken now will under-report the last little while.

Run it on the EC2 host, which has the AWS credentials:

    python3 scripts/count-certificate-downloads.py            # everything on record
    python3 scripts/count-certificate-downloads.py --days 7   # last 7 days
    python3 scripts/count-certificate-downloads.py --csv out.csv
"""

from __future__ import annotations

import argparse
import collections
import csv
import datetime as dt
import re
import subprocess
import sys

LOG_BUCKET = "guinessrecord-access-logs"
LOG_PREFIX = "guinessrecord/"
CERT_PREFIX = "certificates/"

# bucket_owner bucket [time] ip requester req_id OPERATION key "request" status ...
LINE = re.compile(
    r"\[(?P<time>[^\]]+)\]"          # [09/Aug/2026:10:27:23 +0000]
    r".*?"
    r"(?P<op>REST\.\w+\.\w+)\s+"     # REST.GET.OBJECT
    r"(?P<key>\S+)\s+"
    r'"(?P<request>[^"]*)"\s+'
    r"(?P<status>\d{3})"
)


def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"command failed: {' '.join(cmd)}\n{result.stderr.strip()}")
    return result.stdout


def log_keys() -> list[str]:
    out = run(["aws", "s3api", "list-objects-v2", "--bucket", LOG_BUCKET,
               "--prefix", LOG_PREFIX, "--query", "Contents[].Key", "--output", "text"])
    # `--output text` prints the literal "None" when nothing matches the prefix,
    # which otherwise gets treated as a key and fails the fetch with a 404.
    return [k for k in out.split() if k and k != "None"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, help="only count the last N days")
    ap.add_argument("--csv", help="write the per-day counts to this file")
    args = ap.parse_args()

    keys = log_keys()
    if not keys:
        print("No access logs delivered yet.")
        print("S3 writes them on a delay — check again in an hour or so.")
        return
    print(f"reading {len(keys)} log file(s)…", file=sys.stderr)

    cutoff = None
    if args.days:
        cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=args.days)

    per_day: collections.Counter[str] = collections.Counter()
    per_cert: collections.Counter[str] = collections.Counter()
    total = 0

    for key in keys:
        body = run(["aws", "s3", "cp", f"s3://{LOG_BUCKET}/{key}", "-"])
        for line in body.splitlines():
            m = LINE.search(line)
            if not m:
                continue
            # Only real object reads of a certificate. HEADs from the app's
            # regeneration check and PUTs from the generator are not downloads.
            if m["op"] != "REST.GET.OBJECT":
                continue
            if not m["key"].startswith(CERT_PREFIX):
                continue
            if m["status"] not in ("200", "206"):
                continue

            when = dt.datetime.strptime(m["time"], "%d/%b/%Y:%H:%M:%S %z")
            if cutoff and when < cutoff:
                continue

            total += 1
            per_day[when.date().isoformat()] += 1
            per_cert[m["key"]] += 1

    print()
    print(f"  certificate downloads : {total}")
    print(f"  distinct certificates : {len(per_cert)}")
    if per_cert:
        repeats = sum(1 for n in per_cert.values() if n > 1)
        print(f"  downloaded more than once: {repeats}")
    print()
    print("  by day")
    for day in sorted(per_day):
        print(f"    {day}  {per_day[day]}")

    if args.csv and per_day:
        with open(args.csv, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["date", "downloads"])
            for day in sorted(per_day):
                w.writerow([day, per_day[day]])
        print(f"\n  wrote {args.csv}")


if __name__ == "__main__":
    main()
