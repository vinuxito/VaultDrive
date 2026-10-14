#!/usr/bin/env python3
"""Bind NanoRed execution guidance to an explicit, locally verified plan index."""
import argparse
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import unquote, urlsplit


def render(index, output=None, overwrite=False, stdout=False, project=None):
    index = Path(index).expanduser().resolve()
    if not index.is_file() or index.suffix.lower() != '.md':
        raise ValueError('Plan index must be an existing Markdown file.')
    project = Path(project).resolve() if project else Path(__file__).resolve().parents[4]
    plans = (project / 'docs/plans').resolve(strict=True)
    index.relative_to(plans)
    if index.name not in ('index.md', '00-index.md') and not index.name.endswith('-index.md'):
        raise ValueError('Choose index.md, 00-index.md, or *-index.md from ABRN-Drive docs/plans.')
    text = index.read_text(encoding='utf-8')
    if not text.strip():
        raise ValueError('Plan index is empty.')
    has_step = False
    linked_sources = set()
    for target in re.findall(r'\[[^\]]+\]\((<[^>]+>|[^)]+)\)', text):
        target = target.strip().strip('<>')
        # A quoted optional Markdown title is not part of the target path.
        target = re.sub(r'\s+["\'][^"\']*["\']$', '', target)
        link = urlsplit(target)
        if link.scheme or link.netloc or not link.path:
            continue
        local = (index.parent / unquote(link.path)).resolve()
        if not local.exists():
            raise ValueError('Missing local index link: ' + target)
        linked_sources.add(local)
        has_step = has_step or (local.is_file() and local.suffix.lower() == '.md' and local != index and index.parent in local.parents)
    if not has_step:
        raise ValueError('Plan index must link at least one existing Markdown step.')
    template = (Path(__file__).resolve().parent.parent / 'templates' / 'execution-prompt.template.md').read_text(encoding='utf-8')
    marker = 'REPLACE WITH THE INDEX FILE PATH OF THE PLAN TO BUILD'
    if template.count(marker) != 1:
        raise ValueError('Execution brief must have exactly one plan-index slot.')
    result = template.replace(marker, str(index))
    if stdout:
        return result
    candidate = Path(output).expanduser() if output else index.parent / 'execution-brief.md'
    if candidate.is_symlink():
        raise ValueError('Execution brief must not replace a symlink.')
    output = candidate.resolve()
    output.relative_to(index.parent)
    if output in linked_sources:
        raise ValueError('Execution brief must not overwrite a linked source or step.')
    if output == index:
        raise ValueError('Execution brief must not overwrite the plan index.')
    if output.exists():
        if output.read_text(encoding='utf-8') == result:
            return output
        if not overwrite:
            raise ValueError('Output already exists with different content; inspect before using --overwrite.')
    if not output.parent.is_dir():
        raise ValueError('Execution brief output directory does not exist.')
    fd, temporary = tempfile.mkstemp(prefix='.execution-brief-', dir=output.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='') as stream:
            stream.write(result)
        os.chmod(temporary, (output.stat().st_mode & 0o777) if output.exists() else 0o644)
        os.replace(temporary, output)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', required=True, help='The actual plan index prepared for this ticket.')
    parser.add_argument('--output', help='Optional existing-directory output path; defaults beside index.')
    parser.add_argument('--stdout', action='store_true', help='Print exact content without writing a file.')
    parser.add_argument('--overwrite', action='store_true', help='Replace inspected existing output intentionally.')
    args = parser.parse_args()
    try:
        if args.stdout and (args.output or args.overwrite):
            raise ValueError('--stdout cannot be combined with --output or --overwrite.')
        result = render(args.index, args.output, args.overwrite, args.stdout)
        if args.stdout:
            sys.stdout.write(result)
        else:
            print(result)
    except (ValueError, OSError, UnicodeError) as error:
        print('Cannot prepare execution brief: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
