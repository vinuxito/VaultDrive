#!/usr/bin/env python3
"""Package skill folders into a new standalone ZIP. Reject private/generated/escaping resources."""
import argparse
from pathlib import Path
import zipfile

FORBIDDEN = {'.git','.env','.cache','__pycache__','.claude','node_modules'}

def package(sources, output):
    output=Path(output).expanduser().absolute()
    if output.exists() or output.is_symlink(): raise ValueError('Existing output preserved')
    if not output.parent.is_dir(): raise ValueError('Output parent must already exist')
    names=set();entries=[]
    for source in sources:
        source=Path(source).expanduser().resolve()
        if not (source/'SKILL.md').is_file(): raise ValueError('Missing skill entrypoint')
        if source.name in names: raise ValueError('Duplicate skill root name')
        names.add(source.name)
        if output.is_relative_to(source): raise ValueError('Archive must be outside source folders')
        for file in sorted(source.rglob('*')):
            rel=file.relative_to(source)
            if file.is_symlink(): raise ValueError('Symbolic resource cannot be packaged: '+str(file))
            if any(p in FORBIDDEN or p.startswith('.env') for p in rel.parts) or file.suffix=='.pyc':
                raise ValueError('Private/generated resource cannot be packaged: '+str(rel))
            if file.is_file():entries.append((file,str(Path(source.name)/rel)))
    with zipfile.ZipFile(output,'x',compression=zipfile.ZIP_DEFLATED) as z:
        for f,name in entries:z.write(f,name)
    with zipfile.ZipFile(output) as z:
        if z.testzip() is not None:raise ValueError('Archive CRC failed')
        for f,name in entries:
            if z.read(name)!=f.read_bytes():raise ValueError('Archive source parity failed')
    return {'output':str(output),'files':len(entries),'skillRoots':sorted(names),'sourceParity':True}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--skill',action='append',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    try: print(__import__('json').dumps(package(a.skill,a.output),indent=2))
    except (ValueError,OSError) as e:p.exit(1,str(e)+'\n')

if __name__=='__main__':main()
