#!/usr/bin/env python3
"""Translate the existing Docker environment into the native host environment."""
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit, urlunsplit

ROOT = Path("/lamp/www/ABRN-Drive")


def runtime_environment():
    values = {}
    for name in (".env", ".env.runtime"):
        for line in (ROOT / name).read_text().splitlines():
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            key, value = line.split("=", 1)
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            values[key.strip()] = value
    for key in ("DB_URL", "JWT_SECRET"):
        if not values.get(key):
            raise ValueError(f"Missing {key}; refusing to generate replacement secrets")
    db = urlsplit(values["DB_URL"])
    if db.scheme not in ("postgres", "postgresql") or db.path != "/vaultdrive":
        raise ValueError("Expected the existing vaultdrive PostgreSQL database")
    credentials, separator, _ = db.netloc.rpartition("@")
    if not separator:
        raise ValueError("Expected the existing database credentials")
    values.update(
        DB_URL=urlunsplit(db._replace(netloc=credentials + "@127.0.0.1:5432")),
        PORT="8082",
        PGHOST="127.0.0.1",
        PGPORT="5432",
        UPLOAD_DIR="/data/uploads",
        # Match the last deployed docker-compose.yml setting.
        ENABLE_ARGON2ID="false",
    )
    return values


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: prepare-runtime-env.py OUTPUT_FILE")
    values = runtime_environment()
    # Create exclusively: never follow or overwrite an existing file or symlink.
    fd = os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as output:
        for key, value in values.items():
            if not key.replace("_", "").isalnum() or not key.isascii():
                raise ValueError("Invalid environment variable name")
            if not value.isascii() or any(c in value for c in "\n\r\x00"):
                raise ValueError(f"Unsupported environment value for {key}")
            output.write(f"{key}={json.dumps(value)}\n")
    print("Runtime environment prepared; existing secrets preserved.")
