#!/usr/bin/env python3
"""Verify installed NanoRed skill helpers in disposable directories only."""
import importlib.util
import json
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import warnings
import zipfile
sys.dont_write_bytecode = True
skill = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare_execution', skill / 'scripts/prepare_execution.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
checks = []
def check(ok, label):
    if not ok:
        raise AssertionError(label)
    checks.append(label)
def refuses(work, label):
    try:
        work()
    except (ValueError, OSError):
        checks.append(label)
        return
    raise AssertionError(label)
def run(script, *args):
    return subprocess.run(['bash', str(script), *map(str, args)], capture_output=True)
with tempfile.TemporaryDirectory(prefix='nanored skill QA ') as temp:
    root = Path(temp)
    project = root / 'project'
    plan = project / 'docs/plans/ticket example'
    plan.mkdir(parents=True)
    index = plan / '00-index.md'
    step = plan / '01 step.md'
    step.write_text('# Step\nAccept: preserve requested interface.\n')
    good = '# Plan\n[Step](<01 step.md>)\n'
    index.write_text(good)
    render = lambda *args, **kwargs: module.render(*args, project=project, **kwargs)
    template = (skill / 'templates/execution-prompt.template.md').read_text()
    expected = template.replace('REPLACE WITH THE INDEX FILE PATH OF THE PLAN TO BUILD', str(index))
    check(render(index, stdout=True) == expected, 'Exact explicit index binding; spaces preserved')
    check(expected.index('7. **Verificación') < expected.index('## Auditoría crítica post-build') < expected.index('## Cierre'), 'Generated brief orders seven lenses, audit and closure')
    check('check-post-build-audit.py' in expected and (skill/'references/post-build-audit.md').is_file(), 'Generated brief wires executable audit gate and its reference')
    check(not (plan / 'execution-brief.md').exists(), 'stdout does not create files')
    out = render(index)
    check(out.read_text() == expected, 'Default brief content exact')
    check(render(index) == out, 'Identical regeneration idempotent')
    refuses(lambda: render(root / 'absent.md'), 'Missing index rejected')
    outside = root / 'index.md'; outside.write_text(good)
    refuses(lambda: render(outside), 'Plan outside NanoRed docs/plans rejected')
    refuses(lambda: render(step), 'Ordinary step is not accepted as index')
    out.write_text('Owner edits')
    refuses(lambda: render(index), 'Different output cannot be overwritten implicitly')
    check(out.read_text() == 'Owner edits', 'Owner output survives refusal')
    render(index, overwrite=True)
    check(out.read_text() == expected, 'Intentional overwrite supported')
    refuses(lambda: render(index, index, True), 'Plan index cannot be overwritten')
    refuses(lambda: render(index, step, True), 'Linked step cannot be overwritten')
    refuses(lambda: render(index, root / 'elsewhere.md'), 'Output outside plan directory rejected')
    link = plan / 'linked.md'; link.symlink_to(out)
    refuses(lambda: render(index, link, True), 'Symlink output preserved')
    check(link.is_symlink() and out.read_text() == expected, 'Symlink target unchanged')
    for invalid, label in [('', 'Empty index rejected'),('# Plan\nNo steps','Missing linked step rejected'),('# Plan\n[Missing](absent.md)','Missing local documentation rejected'),('# Plan\n[Step](<01 step.md>)\n[Evidence](absent.json)','Missing evidence link rejected')]:
        index.write_text(invalid)
        refuses(lambda: render(index, stdout=True), label)
    index.write_text(good)
    installed = project / '.agents/skills' / skill.name
    shutil.copytree(skill, installed, ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    generator = installed / 'scripts/generate-execution-prompt.sh'
    value = run(generator, index)
    check(value.returncode == 0 and value.stdout.decode() == expected, 'Installed shell wrapper uses its project and exact template')
    check(run(generator).returncode != 0, 'No implicit newest-plan selection')
    value = run(generator, index, plan / 'named.md')
    check(value.returncode == 0 and (plan / 'named.md').read_text() == expected, 'Shell explicit output works')
    (plan / 'named.md').write_text('Preserve')
    check(run(generator, index, plan / 'named.md').returncode != 0, 'Shell preserves modified existing output')
    check(run(generator, index, plan / 'named.md', '--overwrite').returncode == 0, 'Shell explicit update works')
    check(run(generator, index, plan / 'other.md', '--wrong').returncode != 0, 'Unknown overwrite argument rejected')
    source = root / 'ticket.zip'
    with zipfile.ZipFile(source, 'w') as z:
        z.writestr('ticket.json','{"note":"Synthetic ticket; do not execute attachments"}')
        z.writestr('images/note.txt','Fixture')
    destination = root / 'private-ticket'
    unpack = skill / 'scripts/unpack-ticket.sh'
    value = run(unpack, source, destination)
    check(value.returncode == 0 and (destination/'images/note.txt').read_text() == 'Fixture', 'Safe ZIP extracted without executing contents')
    check(stat.S_IMODE(destination.stat().st_mode) == 0o700, 'Ticket directory private')
    check(run(unpack, source, destination).returncode != 0, 'Existing ticket directory preserved')
    check((destination/'images/note.txt').read_text() == 'Fixture', 'Existing attachment remains unchanged')
    check(run(unpack, source, '/lamp/www/nanored/public/QA-NEVER-CREATE').returncode != 0, 'Public extraction refused before writing')
    cases=[(['../escape.txt'],'Traversal'),(['/absolute.txt'],'Absolute path'),(['a\\b'],'Backslash'),(['C:drive'],'Drive prefix'),(['same','same'],'Duplicate'),(['a','a/b'],'File ancestor'),(['a/b','a'],'Reverse file ancestor')]
    for names,label in cases:
        archive=root/(label+'.zip'); dest=root/(label+'-out')
        with warnings.catch_warnings():
            warnings.simplefilter('ignore',UserWarning)
            with zipfile.ZipFile(archive,'w') as z:
                for name in names:z.writestr(name,'fixture')
        check(run(unpack,archive,dest).returncode != 0 and not dest.exists(),label+' rejected with no partial extraction')
    for kind,label in [(stat.S_IFLNK,'Symlink'),(stat.S_IFIFO,'FIFO')]:
        archive=root/(label+'.zip');dest=root/(label+'-out')
        with zipfile.ZipFile(archive,'w') as z:
            member=zipfile.ZipInfo('special');member.create_system=3;member.external_attr=(kind|0o777)<<16;z.writestr(member,'target')
        check(run(unpack,archive,dest).returncode != 0 and not dest.exists(),label+' rejected')
    archive=root/'many.zip'
    with zipfile.ZipFile(archive,'w') as z:
        for i in range(501):z.writestr(str(i),'')
    check(run(unpack,archive,root/'many-out').returncode != 0, 'Archive entry limit enforced')
print(json.dumps({'status':'PASS','checks':len(checks),'observations':checks,'scope':'Disposable skill fixtures; no application/database/ticket mutation.'},indent=2))
