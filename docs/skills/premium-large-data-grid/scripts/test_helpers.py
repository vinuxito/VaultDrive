#!/usr/bin/env python3
"""Focused standard-library checks on isolated synthetic fixtures. No application or database access."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile
sys.dont_write_bytecode = True
SCRIPTS=Path(__file__).resolve().parent

def module(name):
    spec=importlib.util.spec_from_file_location('grid_'+name,SCRIPTS/(name+'.py'))
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

fixtures=module('generate_fixture');installer=module('install');packager=module('package')

class Helpers(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='premium-grid-helper-')
        self.root=Path(self.temp.name);self.source=self.root/'sample-grid';self.source.mkdir()
        (self.source/'SKILL.md').write_text('---\nname: sample-grid\ndescription: Synthetic installation fixture.\n---\n')
        (self.source/'references').mkdir();(self.source/'references/contract.md').write_text('Synthetic contract.\n')
        self.project=self.root/'project';self.project.mkdir()
    def tearDown(self):self.temp.cleanup()
    def test_fixture_deterministic_and_edge_values(self):
        rows=list(fixtures.rows(100));self.assertEqual(rows,list(fixtures.rows(100)))
        self.assertEqual(len({r['id'] for r in rows}),100)
        self.assertTrue(any(r['amountMinor']<0 for r in rows));self.assertTrue(any(r['description']=='' for r in rows))
        self.assertTrue(any('東京' in r['name'] for r in rows));self.assertTrue(all(r['synthetic'] for r in rows))
    def test_fixture_cli_and_existing_output_preserved(self):
        out=self.root/'rows.jsonl'
        cmd=[sys.executable,str(SCRIPTS/'generate_fixture.py'),'--rows','101','--output',str(out)]
        r=subprocess.run(cmd,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr)
        values=[json.loads(x) for x in out.read_text(encoding='utf-8').splitlines()];self.assertEqual(len(values),101)
        before=out.read_bytes();r=subprocess.run(cmd,capture_output=True);self.assertNotEqual(r.returncode,0);self.assertEqual(out.read_bytes(),before)
    def test_invalid_fixture_size_does_not_create(self):
        for count in (0,1000001,-1):
            out=self.root/f'bad-{count}.jsonl'
            r=subprocess.run([sys.executable,str(SCRIPTS/'generate_fixture.py'),'--rows',str(count),'--output',str(out)],capture_output=True)
            self.assertNotEqual(r.returncode,0);self.assertFalse(out.exists())
    def test_project_symlinks_and_idempotence(self):
        first=installer.install([self.source],self.project);second=installer.install([self.source],self.project)
        self.assertEqual(len(first),2);self.assertTrue(all(r['status']=='already_matching' for r in second))
        for r in first:self.assertEqual(Path(r['target']).resolve(),self.source)
    def test_preflight_conflict_preserves_all_destinations(self):
        blocked=self.project/'.claude/skills/sample-grid';blocked.mkdir(parents=True);(blocked/'local.md').write_text('preserve')
        with self.assertRaises(ValueError):installer.install([self.source],self.project)
        self.assertFalse((self.project/'.agents/skills/sample-grid').exists());self.assertEqual((blocked/'local.md').read_text(),'preserve')
    def test_copy_is_complete_and_identical_replay(self):
        values=installer.install([self.source],self.project,mode='copy')
        for value in values:self.assertEqual(installer.inventory(Path(value['target'])),installer.inventory(self.source))
        replay=installer.install([self.source],self.project,mode='copy');self.assertTrue(all(r['status']=='already_matching' for r in replay))
    def test_changed_copy_is_preserved(self):
        values=installer.install([self.source],self.project,mode='copy');target=Path(values[0]['target'])/'references/contract.md';target.write_text('local edits')
        with self.assertRaises(ValueError):installer.install([self.source],self.project,mode='copy')
        self.assertEqual(target.read_text(),'local edits')
    def test_duplicate_destination_refuses_before_mutation(self):
        with self.assertRaises(ValueError):installer.install([self.source,self.source],self.project)
        self.assertFalse((self.project/'.agents').exists())
    def test_package_inventory_and_bytes(self):
        output=self.root/'portable.zip';r=packager.package([self.source],output);self.assertTrue(r['sourceParity'])
        with zipfile.ZipFile(output) as z:
            self.assertEqual(set(z.namelist()),{'sample-grid/SKILL.md','sample-grid/references/contract.md'})
            self.assertEqual(z.read('sample-grid/references/contract.md'),(self.source/'references/contract.md').read_bytes())
    def test_package_existing_output_and_source_output_refused(self):
        output=self.root/'keep.zip';output.write_bytes(b'preserve')
        with self.assertRaises(ValueError):packager.package([self.source],output)
        self.assertEqual(output.read_bytes(),b'preserve')
        with self.assertRaises(ValueError):packager.package([self.source],self.source/'bad.zip')
        self.assertFalse((self.source/'bad.zip').exists())
    def test_package_private_resource_refused_before_creation(self):
        (self.source/'.env').write_text('synthetic private marker')
        with self.assertRaises(ValueError):packager.package([self.source],self.root/'bad.zip')
        self.assertFalse((self.root/'bad.zip').exists())
    def test_package_resource_symlink_refused(self):
        other=self.root/'outside.txt';other.write_text('synthetic outside');(self.source/'references/link.md').symlink_to(other)
        with self.assertRaises(ValueError):packager.package([self.source],self.root/'bad.zip')
        self.assertFalse((self.root/'bad.zip').exists())
    def test_copy_resource_symlink_refused_before_install(self):
        outside=self.root/'outside.txt';outside.write_text('synthetic');(self.source/'references/link.md').symlink_to(outside)
        with self.assertRaises(ValueError):installer.install([self.source],self.project,mode='copy')
        self.assertFalse((self.project/'.agents').exists())

if __name__=='__main__':unittest.main(verbosity=2)
