#!/usr/bin/python3
"""ABRN-only coordinated release installer.

Run this reviewed program with ``/usr/bin/python3 -I`` from a root-owned copy.
It snapshots and verifies the user-owned bundle before using any artifact.
"""
from __future__ import annotations

from contextlib import contextmanager
import fcntl
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
from urllib.parse import parse_qs, unquote, urlsplit
from urllib.request import urlopen

SERVICE = "abrndrive.service"
RUNTIME_ENV = Path("/etc/abrndrive/runtime.env")
BINARY_TARGET = Path("/usr/local/lib/abrndrive/abrndrive")
DIST_TARGET = Path("/lamp/www/ABRN-Drive/vaultdrive_client/dist")
BACKUP_ROOT = Path("/var/backups/abrndrive-release")
LOCK_PATH = Path("/run/lock/abrndrive-release.lock")
MIGRATION = "migrations/050_recovery_attempt_capabilities.sql"
EXPECTED_FILES = {
    "RELEASE.json",
    "FRONTEND-MANIFEST.sha256",
    "abrndrive",
    "frontend-dist.tar",
    "goose",
    MIGRATION,
    "release_installer.py",
}
EXPECTED_TOP_LEVEL = {
    "MANIFEST.sha256",
    "RELEASE.json",
    "FRONTEND-MANIFEST.sha256",
    "abrndrive",
    "frontend-dist.tar",
    "goose",
    "migrations",
    "release_installer.py",
}
EXPECTED_MIGRATIONS = {"050_recovery_attempt_capabilities.sql"}
ENV_KEY = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
BUILD_ID = re.compile(r"^[0-9a-f]{7,64}$")
MAX_FRONTEND_FILES = 10_000
MAX_FRONTEND_FILE_BYTES = 256 * 1024 * 1024
MAX_FRONTEND_TOTAL_BYTES = 2 * 1024 * 1024 * 1024
MIN_FREE_HEADROOM_BYTES = 256 * 1024 * 1024


class ReleaseError(RuntimeError):
    pass


class ReleaseInterrupted(BaseException):
    pass


class EntryAssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.urls: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "script" and values.get("src"):
            self.urls.add(str(values["src"]))
        if tag == "link" and values.get("href") and values.get("rel") in {"stylesheet", "modulepreload"}:
            self.urls.add(str(values["href"]))


def parse_environment_file(path: Path) -> dict[str, str]:
    """Parse systemd-style KEY=VALUE data without executing it."""
    values: dict[str, str] = {}
    for number, source_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = source_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ReleaseError(f"invalid environment assignment on line {number}")
        key, raw = line.split("=", 1)
        key = key.strip()
        if not ENV_KEY.fullmatch(key):
            raise ReleaseError(f"invalid environment key on line {number}")
        try:
            parsed = shlex.split(raw.strip(), comments=True, posix=True)
        except ValueError as exc:
            raise ReleaseError(f"invalid environment quoting on line {number}") from exc
        if len(parsed) != 1:
            raise ReleaseError(f"environment value must be one quoted token on line {number}")
        if any(character in parsed[0] for character in "\r\n\x00"):
            raise ReleaseError(f"invalid control character on line {number}")
        values[key] = parsed[0]
    return values


def postgres_environment(db_url: str) -> dict[str, str]:
    parsed = urlsplit(db_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ReleaseError("DB_URL must use PostgreSQL")
    database = unquote(parsed.path.lstrip("/"))
    if database != "vaultdrive":
        raise ReleaseError("DB_URL must select the existing vaultdrive database")
    host = parsed.hostname or ""
    if host not in {"127.0.0.1", "localhost", ""}:
        raise ReleaseError("DB_URL must use the local PostgreSQL instance")
    query = parse_qs(parsed.query, strict_parsing=False)
    if set(query) - {"sslmode"}:
        raise ReleaseError("DB_URL contains unsupported connection options")
    env = {
        "PATH": "/usr/bin:/bin",
        "LANG": "C",
        "LC_ALL": "C",
        "PGDATABASE": database,
        "PGUSER": unquote(parsed.username or ""),
        "PGHOST": host or "/var/run/postgresql",
        "PGPORT": str(parsed.port or 5432),
    }
    if parsed.password is not None:
        env["PGPASSWORD"] = unquote(parsed.password)
    if query.get("sslmode"):
        env["PGSSLMODE"] = query["sslmode"][-1]
    if not env["PGUSER"]:
        raise ReleaseError("DB_URL must include the existing database user")
    return env


def load_hash_manifest(path: Path, expected: set[str] | None = None) -> dict[str, str]:
    entries: dict[str, str] = {}
    for number, line in enumerate(path.read_text(encoding="ascii").splitlines(), 1):
        if not line:
            continue
        match = re.fullmatch(r"([0-9a-f]{64})  ([^\x00]+)", line)
        if not match:
            raise ReleaseError(f"invalid manifest line {number}")
        digest, relative = match.groups()
        pure = PurePosixPath(relative)
        if pure.is_absolute() or ".." in pure.parts or relative in entries:
            raise ReleaseError(f"unsafe or duplicate manifest path on line {number}")
        entries[relative] = digest
    if expected is not None and set(entries) != expected:
        missing = sorted(expected - set(entries))
        extra = sorted(set(entries) - expected)
        raise ReleaseError(f"manifest contents mismatch; missing={missing}, extra={extra}")
    return entries


def digest_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _secure_copy_file(directory_fd: int, name: str, destination: Path, expected_uid: int, executable: bool) -> None:
    flags = os.O_RDONLY | os.O_NOFOLLOW
    descriptor = os.open(name, flags, dir_fd=directory_fd)
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != expected_uid or metadata.st_mode & 0o022:
            raise ReleaseError(f"unsafe staged file: {name}")
        output_flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
        output = os.open(destination, output_flags, 0o500 if executable else 0o400)
        try:
            while True:
                block = os.read(descriptor, 1024 * 1024)
                if not block:
                    break
                remaining = memoryview(block)
                while remaining:
                    remaining = remaining[os.write(output, remaining):]
            os.fsync(output)
        finally:
            os.close(output)
    finally:
        os.close(descriptor)


def snapshot_stage(stage: Path, expected_uid: int) -> Path:
    if stage.is_symlink() or not stage.is_dir() or stage.stat().st_uid != expected_uid:
        raise ReleaseError("release stage must be a real directory owned by the sudo user")
    if stage.stat().st_mode & 0o077:
        raise ReleaseError("release stage must be private (mode 0700)")
    for parent in stage.parents:
        if parent.is_symlink():
            raise ReleaseError("release directory must not have a symlink parent")
    top = {entry.name for entry in os.scandir(stage)}
    if top != EXPECTED_TOP_LEVEL:
        raise ReleaseError(f"release stage inventory mismatch; unexpected or missing entries: {sorted(top ^ EXPECTED_TOP_LEVEL)}")
    migrations = stage / "migrations"
    if migrations.is_symlink() or not migrations.is_dir() or migrations.stat().st_uid != expected_uid or migrations.stat().st_mode & 0o022:
        raise ReleaseError("migrations must be a non-writable real directory owned by the sudo user")
    migration_names = {entry.name for entry in os.scandir(migrations)}
    if migration_names != EXPECTED_MIGRATIONS:
        raise ReleaseError(f"migration inventory mismatch: {sorted(migration_names ^ EXPECTED_MIGRATIONS)}")

    if BACKUP_ROOT.is_symlink():
        raise ReleaseError("backup root must not be a symlink")
    BACKUP_ROOT.mkdir(parents=True, mode=0o700, exist_ok=True)
    if BACKUP_ROOT.is_symlink() or BACKUP_ROOT.stat().st_uid != os.getuid() or BACKUP_ROOT.stat().st_mode & 0o077:
        raise ReleaseError("backup root must be a root-owned private real directory")
    snapshot = Path(tempfile.mkdtemp(prefix=".bundle-snapshot-", dir=BACKUP_ROOT))
    os.chmod(snapshot, 0o700)
    (snapshot / "migrations").mkdir(mode=0o700)
    stage_fd = os.open(stage, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    migration_fd = os.open("migrations", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=stage_fd)
    try:
        migration_metadata = os.fstat(migration_fd)
        if migration_metadata.st_uid != expected_uid or migration_metadata.st_mode & 0o022:
            raise ReleaseError("opened migration directory is not the reviewed directory")
        for name in sorted(EXPECTED_TOP_LEVEL - {"migrations"}):
            _secure_copy_file(stage_fd, name, snapshot / name, expected_uid, name in {"abrndrive", "goose", "release_installer.py"})
        _secure_copy_file(
            migration_fd,
            "050_recovery_attempt_capabilities.sql",
            snapshot / MIGRATION,
            expected_uid,
            False,
        )
    except BaseException:
        shutil.rmtree(snapshot, ignore_errors=True)
        raise
    finally:
        os.close(migration_fd)
        os.close(stage_fd)
    return snapshot


def verify_bundle(snapshot: Path) -> dict[str, object]:
    entries = load_hash_manifest(snapshot / "MANIFEST.sha256", EXPECTED_FILES)
    for relative, expected in entries.items():
        artifact = snapshot / relative
        if artifact.is_symlink() or not artifact.is_file() or artifact.stat().st_uid != snapshot.stat().st_uid or artifact.stat().st_mode & 0o022:
            raise ReleaseError(f"snapshotted artifact is unsafe: {relative}")
        if digest_file(artifact) != expected:
            raise ReleaseError(f"checksum mismatch: {relative}")
    release = json.loads((snapshot / "RELEASE.json").read_text(encoding="utf-8"))
    required = {
        "product", "build_id", "from_schema", "to_schema", "goose_version", "public_origin",
        "base_path", "frontend_api_url", "agent_key_prefix",
    }
    if set(release) != required:
        raise ReleaseError("RELEASE.json has unexpected fields")
    if release["product"] != "abrndrive" or release["from_schema"] != 49 or release["to_schema"] != 50:
        raise ReleaseError("release product/schema contract is incompatible")
    if not isinstance(release["build_id"], str) or not BUILD_ID.fullmatch(release["build_id"]):
        raise ReleaseError("release build_id must be a Git hexadecimal identifier")
    if release["goose_version"] != "v3.28.0":
        raise ReleaseError("release must bundle Goose v3.28.0")
    if release["public_origin"] != "https://abrndrive.filemonprime.net":
        raise ReleaseError("release public origin is not the ABRN host")
    if release["base_path"] != "/abrn/" or release["frontend_api_url"] != "/api" or release["agent_key_prefix"] != "abrnak":
        raise ReleaseError("release frontend/runtime configuration is not the reviewed ABRN contract")
    running_installer = Path(__file__).resolve()
    if not running_installer.is_file() or digest_file(running_installer) != entries["release_installer.py"]:
        raise ReleaseError("root-owned installer does not match the reviewed bundle")
    return release


def normalize_asset_url(url: str) -> str | None:
    path = urlsplit(url).path
    if not path.endswith((".js", ".css")):
        return None
    if path.startswith("/abrn/"):
        return "dist/" + path.removeprefix("/abrn/")
    if path.startswith("/"):
        raise ReleaseError(f"frontend entry asset uses the wrong base path: {path}")
    return "dist/" + path.removeprefix("./")


def validate_frontend_archive(archive: Path, manifest_path: Path) -> tuple[dict[str, str], set[str]]:
    expected = load_hash_manifest(manifest_path)
    if not expected or "dist/index.html" not in expected or len(expected) > MAX_FRONTEND_FILES:
        raise ReleaseError("frontend manifest is empty, oversized, or lacks dist/index.html")
    if any(not path.startswith("dist/") for path in expected):
        raise ReleaseError("frontend manifest paths must be under dist/")
    seen: set[str] = set()
    folded: set[str] = set()
    total = 0
    contents: dict[str, bytes] = {}
    with tarfile.open(archive, "r:") as bundle:
        members = bundle.getmembers()
        if len(members) > MAX_FRONTEND_FILES * 2:
            raise ReleaseError("frontend archive has too many members")
        for member in members:
            pure = PurePosixPath(member.name)
            if pure.is_absolute() or ".." in pure.parts or not pure.parts or pure.parts[0] != "dist":
                raise ReleaseError(f"unsafe frontend archive member: {member.name}")
            if member.issym() or member.islnk() or member.isdev() or not (member.isdir() or member.isfile()) or member.sparse:
                raise ReleaseError(f"unsupported frontend archive member: {member.name}")
            canonical = str(pure)
            if canonical in seen or canonical.casefold() in folded:
                raise ReleaseError(f"duplicate or case-colliding frontend member: {canonical}")
            seen.add(canonical)
            folded.add(canonical.casefold())
            if not member.isfile():
                continue
            if member.size > MAX_FRONTEND_FILE_BYTES:
                raise ReleaseError(f"frontend file is too large: {canonical}")
            total += member.size
            if total > MAX_FRONTEND_TOTAL_BYTES:
                raise ReleaseError("frontend archive expands beyond the release limit")
            source = bundle.extractfile(member)
            if source is None:
                raise ReleaseError(f"frontend file cannot be read: {canonical}")
            data = source.read(MAX_FRONTEND_FILE_BYTES + 1)
            if len(data) != member.size:
                raise ReleaseError(f"frontend file size is inconsistent: {canonical}")
            contents[canonical] = data
    if set(contents) != set(expected):
        raise ReleaseError("frontend archive and frontend manifest inventories differ")
    for relative, data in contents.items():
        if hashlib.sha256(data).hexdigest() != expected[relative]:
            raise ReleaseError(f"frontend checksum mismatch: {relative}")
    parser = EntryAssetParser()
    parser.feed(contents["dist/index.html"].decode("utf-8"))
    entry_assets = {asset for url in parser.urls if (asset := normalize_asset_url(url)) is not None}
    if not entry_assets or not any(asset.endswith(".js") for asset in entry_assets):
        raise ReleaseError("frontend index has no bundled JavaScript entry asset")
    missing = entry_assets - set(expected)
    if missing:
        raise ReleaseError(f"frontend index references missing entry assets: {sorted(missing)}")
    return expected, entry_assets


def run(command: list[str], *, env: dict[str, str] | None = None, capture: bool = False, private_log: Path | None = None) -> str:
    if capture and private_log is not None:
        raise ReleaseError("command output cannot be captured and logged simultaneously")
    log_handle = None
    if private_log is not None:
        fd = os.open(private_log, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        log_handle = os.fdopen(fd, "w")
    try:
        result = subprocess.run(
            command,
            env=env,
            check=True,
            text=True,
            stdout=subprocess.PIPE if capture else log_handle,
            stderr=subprocess.PIPE if capture else (subprocess.STDOUT if log_handle else None),
        )
    finally:
        if log_handle is not None:
            log_handle.close()
    return result.stdout.strip() if capture else ""


def schema_version(db_env: dict[str, str]) -> int:
    output = run(["/usr/bin/psql", "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", "SELECT version_id || ':' || CASE WHEN is_applied THEN 't' ELSE 'f' END FROM goose_db_version ORDER BY id DESC LIMIT 1"], env=db_env, capture=True)
    match = re.fullmatch(r"(\d+):t", output)
    if not match:
        raise ReleaseError("database migration state is missing or dirty")
    version = int(match.group(1))
    if version not in {49, 50}:
        raise ReleaseError(f"database schema {version} is incompatible; expected 49 or retry-safe 50")
    return version


SCHEMA_50_VALIDATION_SQL = r"""
SELECT (
  to_regclass('public.account_recovery_attempts') IS NOT NULL
  AND to_regclass('public.account_recovery_attempt_approvals') IS NOT NULL
  AND (SELECT count(*) = 10 FROM information_schema.columns WHERE table_schema='public' AND table_name='account_recovery_attempts'
       AND ((column_name='id' AND data_type='uuid' AND is_nullable='NO')
         OR (column_name='user_id' AND data_type='uuid' AND is_nullable='NO')
         OR (column_name='capability_hash' AND data_type='character' AND character_maximum_length=64 AND is_nullable='NO')
         OR (column_name='verification_code' AND data_type='character varying' AND character_maximum_length=12 AND is_nullable='NO')
         OR (column_name='threshold' AND data_type='integer' AND is_nullable='NO')
         OR (column_name='status' AND data_type='character varying' AND character_maximum_length=16 AND is_nullable='NO' AND column_default LIKE '%active%')
         OR (column_name='expires_at' AND data_type='timestamp with time zone' AND is_nullable='NO')
         OR (column_name='created_at' AND data_type='timestamp with time zone' AND is_nullable='NO')
         OR (column_name='updated_at' AND data_type='timestamp with time zone' AND is_nullable='NO')
         OR (column_name='consumed_at' AND data_type='timestamp with time zone' AND is_nullable='YES')))
  AND (SELECT count(*) = 11 FROM information_schema.columns WHERE table_schema='public' AND table_name='account_recovery_attempt_approvals'
       AND ((column_name='id' AND data_type='uuid' AND is_nullable='NO')
         OR (column_name='attempt_id' AND data_type='uuid' AND is_nullable='NO')
         OR (column_name='recovery_share_id' AND data_type='uuid' AND is_nullable='NO')
         OR (column_name='custodian_id' AND data_type='uuid' AND is_nullable='NO')
         OR (column_name='share_index' AND data_type='smallint' AND is_nullable='NO')
         OR (column_name='challenge' AND data_type='character varying' AND character_maximum_length=64 AND is_nullable='NO')
         OR (column_name='status' AND data_type='character varying' AND character_maximum_length=16 AND is_nullable='NO' AND column_default LIKE '%pending%')
         OR (column_name='decrypted_share_part' AND data_type='text' AND is_nullable='YES')
         OR (column_name='approved_at' AND data_type='timestamp with time zone' AND is_nullable='YES')
         OR (column_name='created_at' AND data_type='timestamp with time zone' AND is_nullable='NO')
         OR (column_name='updated_at' AND data_type='timestamp with time zone' AND is_nullable='NO')))
  AND (SELECT count(*) FILTER (WHERE contype='p')=1
          AND count(*) FILTER (WHERE contype='f')=1
          AND count(*) FILTER (WHERE contype='u')=1
          AND count(*) FILTER (WHERE contype='c')=3
       FROM pg_constraint WHERE conrelid='account_recovery_attempts'::regclass)
  AND (SELECT count(*) FILTER (WHERE contype='p')=1
          AND count(*) FILTER (WHERE contype='f')=3
          AND count(*) FILTER (WHERE contype='u')=4
          AND count(*) FILTER (WHERE contype='c')=3
       FROM pg_constraint WHERE conrelid='account_recovery_attempt_approvals'::regclass)
  AND (SELECT count(*)=1 FROM pg_constraint WHERE conrelid='account_recovery_attempts'::regclass AND contype='f' AND pg_get_constraintdef(oid) LIKE '%REFERENCES users(id) ON DELETE CASCADE%')
  AND (SELECT count(*)=3 FROM pg_constraint WHERE conrelid='account_recovery_attempt_approvals'::regclass AND contype='f' AND pg_get_constraintdef(oid) LIKE '%ON DELETE CASCADE%')
  AND to_regclass('public.idx_recovery_attempts_one_active_user') IS NOT NULL
  AND to_regclass('public.idx_recovery_attempts_expiry') IS NOT NULL
  AND to_regclass('public.idx_recovery_attempt_approvals_custodian') IS NOT NULL
  AND pg_get_indexdef('idx_recovery_attempts_one_active_user'::regclass) LIKE '%WHERE ((status)::text = ''active''::text)%'
  AND (SELECT column_default LIKE '%configured%' FROM information_schema.columns WHERE table_schema='public' AND table_name='account_recovery_shares' AND column_name='status')
  AND NOT EXISTS (SELECT 1 FROM account_recovery_shares WHERE decrypted_share_part IS NOT NULL OR status <> 'configured')
)::text
"""


def validate_schema_50(db_env: dict[str, str]) -> None:
    if run(["/usr/bin/psql", "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", SCHEMA_50_VALIDATION_SQL], env=db_env, capture=True) != "true":
        raise ReleaseError("schema 50 does not match the reviewed recovery security contract")


def database_size(db_env: dict[str, str]) -> int:
    output = run(["/usr/bin/psql", "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", "SELECT pg_database_size(current_database())"], env=db_env, capture=True)
    if not output.isdigit():
        raise ReleaseError("database size preflight returned an invalid value")
    return int(output)


def path_size(path: Path) -> int:
    if not path.exists():
        return 0
    if path.is_file():
        return path.stat().st_size
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file() and not item.is_symlink())


def ensure_free_space(snapshot: Path, db_size: int) -> None:
    required = int(db_size * 1.25) + path_size(DIST_TARGET) + path_size(snapshot / "frontend-dist.tar") * 2 + path_size(BINARY_TARGET) * 2 + MIN_FREE_HEADROOM_BYTES
    targets = {BACKUP_ROOT, DIST_TARGET.parent, BINARY_TARGET.parent}
    for target in targets:
        existing = target
        while not existing.exists():
            existing = existing.parent
        if shutil.disk_usage(existing).free < required:
            raise ReleaseError(f"insufficient free space on release filesystem: {existing}")


def service_is_active() -> bool:
    return subprocess.run(["/usr/bin/systemctl", "is-active", "--quiet", SERVICE], check=False).returncode == 0


def systemctl(action: str, *, check: bool = True) -> None:
    if action not in {"stop", "start"}:
        raise ReleaseError("unsupported service action")
    subprocess.run(["/usr/bin/systemctl", action, SERVICE], check=check)


def ensure_service_state(active: bool) -> None:
    systemctl("start" if active else "stop", check=False)
    if service_is_active() != active:
        raise ReleaseError(f"could not leave {SERVICE} {'active' if active else 'stopped'}")


def fetch_json(url: str, timeout: int = 5) -> dict[str, object]:
    with urlopen(url, timeout=timeout) as response:
        if response.status != 200:
            raise ReleaseError(f"HTTP {response.status} from release probe")
        return json.loads(response.read().decode("utf-8"))


def fetch_asset(url: str, timeout: int = 15) -> tuple[bytes, str]:
    with urlopen(url, timeout=timeout) as response:
        if response.status != 200:
            raise ReleaseError(f"HTTP {response.status} from frontend probe")
        return response.read(), response.headers.get_content_type()


def verify_asset(url: str, expected_hash: str, relative: str) -> None:
    data, content_type = fetch_asset(url)
    if hashlib.sha256(data).hexdigest() != expected_hash:
        raise ReleaseError(f"frontend asset mismatch: {relative}")
    if relative.endswith(".js") and "javascript" not in content_type:
        raise ReleaseError(f"frontend JavaScript content type mismatch: {relative}")
    if relative.endswith(".css") and content_type != "text/css":
        raise ReleaseError(f"frontend CSS content type mismatch: {relative}")


@contextmanager
def release_lock():
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(LOCK_PATH, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise ReleaseError("another ABRN release is already running") from exc
        yield
    finally:
        os.close(descriptor)


@contextmanager
def interrupt_guard():
    previous: dict[int, object] = {}

    def interrupted(signum: int, _frame: object) -> None:
        raise ReleaseInterrupted(f"release interrupted by signal {signum}")

    for signum in (signal.SIGINT, signal.SIGTERM):
        previous[signum] = signal.getsignal(signum)
        signal.signal(signum, interrupted)
    try:
        yield
    finally:
        for signum, handler in previous.items():
            signal.signal(signum, handler)


def main(argv: list[str]) -> int:
    if sys.version_info < (3, 11):
        raise ReleaseError("release requires /usr/bin/python3 version 3.11 or newer")
    if os.geteuid() != 0:
        raise ReleaseError("run the root-owned reviewed installer with sudo /usr/bin/python3 -I")
    if len(argv) != 2:
        raise ReleaseError("usage: /usr/bin/python3 -I /root-owned/release_installer.py /absolute/private/release-directory")
    stage = Path(argv[1])
    if not stage.is_absolute() or stage == Path("/lamp/www") or Path("/lamp/www") in stage.parents:
        raise ReleaseError("release directory must be absolute and outside the shared application tree")
    sudo_uid = os.environ.get("SUDO_UID")
    if sudo_uid is None or not sudo_uid.isdigit():
        raise ReleaseError("release requires a recorded sudo user")

    snapshot: Path | None = None
    with release_lock():
        try:
            snapshot = snapshot_stage(stage, int(sudo_uid))
            release = verify_bundle(snapshot)
            frontend_hashes, entry_assets = validate_frontend_archive(snapshot / "frontend-dist.tar", snapshot / "FRONTEND-MANIFEST.sha256")
            values = parse_environment_file(RUNTIME_ENV)
            if "DB_URL" not in values:
                raise ReleaseError("preserved runtime environment has no DB_URL")
            if values.get("BASE_PATH") != release["base_path"] or values.get("AGENT_KEY_PREFIX") != release["agent_key_prefix"]:
                raise ReleaseError("preserved runtime base path or agent-key prefix does not match this release")
            db_env = postgres_environment(values["DB_URL"])
            if str(release["goose_version"]) not in run([str(snapshot / "goose"), "-version"], capture=True):
                raise ReleaseError("bundled Goose version does not match RELEASE.json")
            initial_schema = schema_version(db_env)
            if initial_schema == 50:
                validate_schema_50(db_env)
            size = database_size(db_env)
            ensure_free_space(snapshot, size)
            if not service_is_active():
                raise ReleaseError(f"{SERVICE} must be active before release")

            timestamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
            backup = BACKUP_ROOT / f"{timestamp}-{release['build_id']}"
            backup.mkdir(mode=0o700, exist_ok=False)
            os.chmod(backup, 0o700)
            shutil.copy2(snapshot / "MANIFEST.sha256", backup / "release-MANIFEST.sha256")
            shutil.copy2(snapshot / "RELEASE.json", backup / "RELEASE.json")

            mutation_started = False
            post_migration_boundary = initial_schema == 50
            try:
                with interrupt_guard():
                    mutation_started = True
                    systemctl("stop")
                    if service_is_active():
                        raise ReleaseError("ABRN service did not stop")

                    run(["/usr/bin/pg_dump", "--format=custom", "--no-owner", "--file", str(backup / "database.dump")], env=db_env, private_log=backup / "pg_dump.log")
                    dump = backup / "database.dump"
                    if not dump.is_file() or dump.stat().st_size == 0:
                        raise ReleaseError("database backup is empty")
                    os.chmod(dump, 0o600)
                    run(["/usr/bin/pg_restore", "--list", str(dump)], env=db_env, private_log=backup / "pg_restore-list.log")
                    versions = {
                        "server": run(["/usr/bin/psql", "-X", "-Atqc", "SHOW server_version"], env=db_env, capture=True),
                        "pg_dump": run(["/usr/bin/pg_dump", "--version"], env=db_env, capture=True),
                        "pg_restore": run(["/usr/bin/pg_restore", "--version"], env=db_env, capture=True),
                    }
                    (backup / "database-versions.json").write_text(json.dumps(versions, indent=2) + "\n", encoding="utf-8")
                    if BINARY_TARGET.exists():
                        shutil.copy2(BINARY_TARGET, backup / "abrndrive")
                    if DIST_TARGET.exists():
                        with tarfile.open(backup / "frontend-dist.tar", "w") as archive:
                            archive.add(DIST_TARGET, arcname="dist", recursive=True)
                    shutil.copy2(RUNTIME_ENV, backup / "runtime.env")
                    os.chmod(backup / "runtime.env", 0o600)
                    unit_path = Path(run(["/usr/bin/systemctl", "show", "-p", "FragmentPath", "--value", SERVICE], capture=True))
                    if unit_path.is_file():
                        shutil.copy2(unit_path, backup / "abrndrive.service")
                    (backup / "schema-before.txt").write_text(f"{initial_schema}\n", encoding="ascii")

                    if initial_schema == 49:
                        migration_root = backup / "migration"
                        migration_root.mkdir(mode=0o700)
                        shutil.copy2(snapshot / MIGRATION, migration_root / Path(MIGRATION).name)
                        os.chmod(migration_root / Path(MIGRATION).name, 0o400)
                        goose_env = db_env.copy()
                        goose_env.update(GOOSE_DRIVER="postgres", GOOSE_DBSTRING=values["DB_URL"])
                        post_migration_boundary = True
                        run([str(snapshot / "goose"), "-dir", str(migration_root), "up"], env=goose_env, private_log=backup / "goose.log")
                    if schema_version(db_env) != 50:
                        raise ReleaseError("migration did not reach schema 50")
                    validate_schema_50(db_env)

                    binary_new = BINARY_TARGET.with_name("abrndrive.release-new")
                    shutil.copyfile(snapshot / "abrndrive", binary_new)
                    os.chmod(binary_new, 0o755)
                    os.replace(binary_new, BINARY_TARGET)

                    dist_parent = DIST_TARGET.parent
                    dist_new = dist_parent / "dist.release-new"
                    if dist_new.exists():
                        shutil.rmtree(dist_new)
                    with tempfile.TemporaryDirectory(dir=dist_parent, prefix="dist.extract-") as extract_root:
                        with tarfile.open(snapshot / "frontend-dist.tar", "r:") as archive:
                            archive.extractall(extract_root, filter="data")
                        shutil.move(str(Path(extract_root) / "dist"), dist_new)
                    for relative, expected_hash in frontend_hashes.items():
                        installed = dist_new / PurePosixPath(relative).relative_to("dist")
                        if digest_file(installed) != expected_hash:
                            raise ReleaseError(f"extracted frontend mismatch: {relative}")
                    if DIST_TARGET.exists():
                        shutil.rmtree(DIST_TARGET)
                    os.replace(dist_new, DIST_TARGET)

                    systemctl("start")
                    if not service_is_active():
                        raise ReleaseError("ABRN service did not start")
                    ready: dict[str, object] | None = None
                    for _ in range(30):
                        try:
                            ready = fetch_json("http://127.0.0.1:8082/ready")
                            break
                        except Exception:
                            time.sleep(1)
                    if ready is None or ready.get("status") != "ready":
                        raise ReleaseError("local readiness did not become ready")
                    diagnostics = ready.get("diagnostics")
                    migrations = diagnostics.get("migrations") if isinstance(diagnostics, dict) else None
                    if migrations != "ok (version: 50)":
                        raise ReleaseError("readiness did not confirm schema 50")
                    health = fetch_json("http://127.0.0.1:8082/health")
                    if health.get("status") != "ok" or health.get("version") != release["build_id"]:
                        raise ReleaseError("local health build identity mismatch")
                    public_health = fetch_json(str(release["public_origin"]) + "/health", timeout=15)
                    if public_health.get("status") != "ok" or public_health.get("version") != release["build_id"]:
                        raise ReleaseError("public health build identity mismatch")
                    for relative in sorted(entry_assets):
                        suffix = relative.removeprefix("dist/")
                        verify_asset(f"http://127.0.0.1:8082/abrn/{suffix}", frontend_hashes[relative], relative)
                        verify_asset(f"{release['public_origin']}/abrn/{suffix}", frontend_hashes[relative], relative)
                    verify_asset("http://127.0.0.1:8082/abrn/", frontend_hashes["dist/index.html"], "dist/index.html")
                    verify_asset(f"{release['public_origin']}/abrn/", frontend_hashes["dist/index.html"], "dist/index.html")
                    print(f"ABRN release {release['build_id']} verified; backup: {backup}")
                    return 0
            except BaseException:
                if mutation_started:
                    ensure_service_state(not post_migration_boundary)
                    if post_migration_boundary:
                        print(f"Release failed after the schema-50 boundary. {SERVICE} is verified stopped. Backup: {backup}. Do not restore the old recovery binary automatically.", file=sys.stderr)
                    else:
                        print(f"Release failed before migration. The unchanged service is verified active. Private diagnostics: {backup}", file=sys.stderr)
                raise
        finally:
            if snapshot is not None:
                shutil.rmtree(snapshot, ignore_errors=True)


def entrypoint(argv: list[str]) -> int:
    try:
        return main(argv)
    except ReleaseError as exc:
        print(f"release refused: {exc}", file=sys.stderr)
        return 1
    except BaseException:
        print("release failed unexpectedly; sensitive details and traceback suppressed", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(entrypoint(sys.argv))
