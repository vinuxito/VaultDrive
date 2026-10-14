#!/usr/bin/env python3
"""Install complete skill folders with preflight and no silent overwrite. Python standard library only."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import sys

def inventory(folder):
    result = {}
    for file in sorted(folder.rglob('*')):
        if '__pycache__' in file.parts or file.suffix == '.pyc': continue
        if file.is_symlink(): raise ValueError('Symbolic resource preserved; inspect before copying: ' + str(file))
        if file.is_file(): result[str(file.relative_to(folder))] = hashlib.sha256(file.read_bytes()).hexdigest()
    return result

def install(sources, project=None, global_mode=False, mode='symlink'):
    pairs = []
    for source in sources:
        source = Path(source).expanduser().resolve()
        if not (source/'SKILL.md').is_file(): raise ValueError('Missing SKILL.md: ' + str(source))
        targets = []
        if project:
            project_path = Path(project).expanduser().resolve()
            if not project_path.is_dir(): raise ValueError('Project must already exist')
            targets += [project_path/'.agents/skills'/source.name, project_path/'.claude/skills'/source.name]
        if global_mode:
            codex_home = Path(os.environ.get('CODEX_HOME', str(Path.home()/'.codex'))).expanduser().resolve()
            targets += [codex_home/'skills'/source.name, Path.home()/'.agents/skills'/source.name]
        if not targets: raise ValueError('Choose --project and/or --global')
        for target in targets:
            if any(target == p[1] for p in pairs): raise ValueError('Duplicate skill destination: ' + str(target))
            same = target.resolve() == source if target.exists() else False
            if not same and (target.exists() or target.is_symlink()):
                if mode == 'copy' and target.is_dir() and not target.is_symlink() and inventory(target) == inventory(source): same = True
                else: raise ValueError('Different existing destination preserved: ' + str(target))
            if mode == 'copy': inventory(source)
            pairs.append((source, target, same))
    # All destinations have passed before the first mutation. Recheck before each create.
    for source, target, same in pairs:
        if same: continue
        if target.exists() or target.is_symlink(): raise ValueError('Destination appeared; preserved: ' + str(target))
        target.parent.mkdir(parents=True, exist_ok=True)
        if mode == 'copy': shutil.copytree(source, target, ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
        else: target.symlink_to(source, target_is_directory=True)
    return [{'source':str(s),'target':str(t),'status':'already_matching' if same else 'installed','mode':mode} for s,t,same in pairs]

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--skill',action='append',type=Path)
    p.add_argument('--project',type=Path)
    p.add_argument('--global',dest='global_mode',action='store_true')
    p.add_argument('--mode',choices=('symlink','copy'),default='symlink')
    a=p.parse_args()
    try: print(__import__('json').dumps(install(a.skill or [Path(__file__).resolve().parents[1]],a.project,a.global_mode,a.mode),indent=2))
    except (ValueError,OSError) as e: p.exit(1,str(e)+'\n')

if __name__ == '__main__': main()
