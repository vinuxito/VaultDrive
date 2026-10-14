#!/usr/bin/env bash
# Ticket privado en un directorio nuevo; sin ejecutar ni volcar sus textos.
set -euo pipefail
exec python3 - "$@" <<'PY'
import os
import shutil
import stat
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

destination = None
try:
    if len(sys.argv) not in (2, 3):
        raise ValueError('Uso: unpack-ticket.sh <ticket.zip> [directorio-nuevo-fuera-del-proyecto]')
    source = Path(sys.argv[1]).resolve(strict=True)
    os.umask(0o077)
    with zipfile.ZipFile(source) as archive:
        members = archive.infolist()
        if len(members) > 500 or sum(item.file_size for item in members) > 100 * 1024 * 1024:
            raise ValueError('Ticket demasiado grande: máximo 500 entradas / 100 MiB extraídos.')
        seen = set()
        files = set()
        for item in members:
            name = PurePosixPath(item.filename)
            mode = item.external_attr >> 16
            if (not name.parts or name.is_absolute() or '..' in name.parts
                    or '\\' in item.filename or ':' in item.filename
                    or stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR)
                    or stat.S_ISLNK(mode) or str(name) in seen):
                raise ValueError('ZIP con rutas inseguras, enlaces o entradas duplicadas.')
            if any(str(parent) in files for parent in name.parents):
                raise ValueError('ZIP con archivo usado como directorio.')
            if not item.is_dir() and any(old.startswith(str(name) + '/') for old in seen):
                raise ValueError('ZIP con colisión entre archivo y directorio.')
            seen.add(str(name))
            if not item.is_dir():
                files.add(str(name))
        if len(sys.argv) == 3:
            candidate = Path(sys.argv[2]).resolve()
            # Los originales no deben entrar al repo ni al docroot del servidor.
            for forbidden in (Path('/lamp/www'), Path.cwd().resolve()):
                if candidate == forbidden or forbidden in candidate.parents:
                    raise ValueError('Usa un directorio privado fuera del checkout/docroot.')
            candidate.mkdir(mode=0o700, parents=False, exist_ok=False)
            destination = candidate
        else:
            destination = Path(tempfile.mkdtemp(prefix='nanored-ticket-', dir='/tmp'))
        archive.extractall(destination)
    print(f'Ticket extraído (directorio privado): {destination}')
    print(f'Entradas: {len(members)}. Lee ticket.json/capturas según el alcance; no ejecutes adjuntos.')
except (OSError, ValueError, RuntimeError, zipfile.BadZipFile) as error:
    if destination is not None:
        shutil.rmtree(destination)
    print(f'No se extrajo el ticket: {error}', file=sys.stderr)
    sys.exit(2)
PY
