#!/usr/bin/env python3
"""Download and verify the resource containers published by KartSim."""

import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import threading
import time
from urllib.parse import quote

import requests
from concurrent.futures import ThreadPoolExecutor, as_completed


ORIGIN = "https://kart.10002221.xyz"
ROOT = Path(__file__).resolve().parent / "mirror"
THREAD_LOCAL = threading.local()


def read_curl_cookies(path):
    cookies = {}
    for line in Path(path).read_text().splitlines():
        if line.startswith("#HttpOnly_"):
            line = line[len("#HttpOnly_"):]
        elif line.startswith("#") or not line:
            continue
        fields = line.split("\t")
        if len(fields) == 7:
            cookies[fields[5]] = fields[6]
    return cookies


def session(cookies):
    client = requests.Session()
    client.headers.update({"User-Agent": "KartSim-local-mirror/1.0"})
    client.cookies.update(cookies)
    return client


def worker_session(cookies):
    if not hasattr(THREAD_LOCAL, "client"):
        THREAD_LOCAL.client = session(cookies)
    return THREAD_LOCAL.client


def save_response(client, url, path):
    response = client.get(url, timeout=(15, 120))
    response.raise_for_status()
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".part")
    temp.write_bytes(response.content)
    os.replace(temp, path)
    return response


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_file(entry, version, cookies):
    name = entry["name"]
    relative = Path(name)
    if relative.is_absolute() or ".." in relative.parts or not name or "\\" in name:
        raise ValueError("unsafe resource path: " + name)
    destination = ROOT / version / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    expected_size = entry["size"]
    expected_hash = entry["sha256"].lower()
    if destination.exists() and destination.stat().st_size == expected_size:
        if sha256_file(destination) == expected_hash:
            return name, expected_size, False

    temp = destination.with_name(destination.name + ".part")
    if temp.exists() and temp.stat().st_size == expected_size:
        if sha256_file(temp) == expected_hash:
            os.replace(temp, destination)
            return name, expected_size, True
        temp.unlink()
    url = ORIGIN + "/" + version + "/" + quote(name, safe="/")
    client = worker_session(cookies)
    last_error = None
    for attempt in range(5):
        try:
            offset = temp.stat().st_size if temp.exists() else 0
            if offset > expected_size:
                temp.unlink()
                offset = 0
            headers = {"Range": "bytes=%d-" % offset} if offset else {}
            with client.get(url, headers=headers, stream=True, timeout=(15, 120)) as response:
                response.raise_for_status()
                if offset and response.status_code == 206:
                    mode = "ab"
                else:
                    mode = "wb"
                with temp.open(mode) as handle:
                    for chunk in response.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            handle.write(chunk)
            if temp.stat().st_size != expected_size:
                raise IOError("size mismatch: %d != %d" % (temp.stat().st_size, expected_size))
            if sha256_file(temp) != expected_hash:
                temp.unlink()
                raise IOError("SHA-256 mismatch")
            os.replace(temp, destination)
            return name, expected_size, True
        except Exception as error:
            last_error = error
            if attempt < 4:
                time.sleep(min(2 ** attempt, 8))
    raise RuntimeError("%s: %s" % (name, last_error))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="p3553", choices=["p3528", "p3543", "p3553"])
    parser.add_argument("--cookie-file", help="Existing curl cookie jar (kept outside the mirror)")
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    cookies = read_curl_cookies(args.cookie_file) if args.cookie_file else {}
    client = session(cookies)
    if not cookies:
        password = getpass.getpass("Website access password: ")
        response = client.post(ORIGIN + "/__gate?next=%2F", json={"password": password, "next": "/"}, timeout=30)
        response.raise_for_status()
        if not response.json().get("ok"):
            raise RuntimeError("Website rejected the password")
        cookies = client.cookies.get_dict()

    manifest_path = ROOT / ("__" + args.version) / "resources"
    response = save_response(client, ORIGIN + "/__" + args.version + "/resources", manifest_path)
    manifest = response.json()
    if manifest.get("version") != args.version or not isinstance(manifest.get("files"), list):
        raise RuntimeError("Resource manifest for %s is unavailable" % args.version)
    save_response(client, ORIGIN + "/__" + args.version + "/archive-index", ROOT / ("__" + args.version) / "archive-index")
    files = manifest["files"]
    total_bytes = sum(item["size"] for item in files)
    print("%s: %d files, %.2f GiB" % (args.version, len(files), total_bytes / 1024 ** 3), flush=True)
    done_bytes = 0
    downloaded = 0
    failures = []
    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(download_file, item, args.version, cookies) for item in files]
        for index, future in enumerate(as_completed(futures), 1):
            try:
                _, size, changed = future.result()
                done_bytes += size
                downloaded += int(changed)
            except Exception as error:
                failures.append(str(error))
            if index % 50 == 0 or index == len(files):
                print("%d/%d checked, %.2f/%.2f GiB, %d downloaded, %d failed, %.0fs" % (
                    index, len(files), done_bytes / 1024 ** 3, total_bytes / 1024 ** 3,
                    downloaded, len(failures), time.monotonic() - started), flush=True)
    if failures:
        for failure in failures:
            print("FAILED", failure, flush=True)
        raise SystemExit(1)
    print("All manifest files passed size and SHA-256 verification.", flush=True)


if __name__ == "__main__":
    main()
