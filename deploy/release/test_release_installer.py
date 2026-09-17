import contextlib, hashlib, io, json, os, subprocess, sys, tarfile, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import release_installer as ri


def manifest(path, entries):
    path.write_text("\n".join(f"{hashlib.sha256(data).hexdigest()}  {name}" for name,data in sorted(entries.items()))+"\n")


def bundle(root):
    stage=root/'release'; stage.mkdir(mode=0o700)
    web={'dist/index.html':b'<script type="module" src="/abrn/assets/app.js"></script><link rel="stylesheet" href="/abrn/assets/app.css">','dist/assets/app.js':b'console.log(1)','dist/assets/app.css':b'body{color:#111}'}
    with tarfile.open(stage/'frontend-dist.tar','w') as tar:
        for d in ('dist','dist/assets'):
            i=tarfile.TarInfo(d); i.type=tarfile.DIRTYPE; tar.addfile(i)
        for n,d in web.items():
            i=tarfile.TarInfo(n); i.size=len(d); tar.addfile(i,io.BytesIO(d))
    manifest(stage/'FRONTEND-MANIFEST.sha256',web)
    (stage/'migrations').mkdir(); (stage/ri.MIGRATION).write_text('-- fixture\n')
    (stage/'abrndrive').write_bytes(b'new backend'); (stage/'goose').write_bytes(b'goose')
    (stage/'release_installer.py').write_bytes(Path(ri.__file__).read_bytes())
    (stage/'RELEASE.json').write_text(json.dumps({'product':'abrndrive','build_id':'abcdef1','from_schema':49,'to_schema':50,'goose_version':'v3.28.0','public_origin':'https://abrndrive.filemonprime.net','base_path':'/abrn/','frontend_api_url':'/api','agent_key_prefix':'abrnak'}))
    manifest(stage/'MANIFEST.sha256',{n:(stage/n).read_bytes() for n in ri.EXPECTED_FILES})
    for p in stage.rglob('*'):
        p.chmod(0o500 if p.is_dir() or p.name in {'abrndrive','goose','release_installer.py'} else 0o400)
    return stage,web


def refresh(stage):
    p=stage/'MANIFEST.sha256'; p.chmod(0o600); manifest(p,{n:(stage/n).read_bytes() for n in ri.EXPECTED_FILES}); p.chmod(0o400)


class Fx:
    def __init__(self,root,failure=None,schema=49):
        self.stage,self.web=bundle(root); self.failure=failure
        self.runtime=root/'runtime.env'; self.runtime.write_text('DB_URL="postgres://release:secret@127.0.0.1:5432/vaultdrive?sslmode=disable"\nBASE_PATH="/abrn/"\nAGENT_KEY_PREFIX="abrnak"\n')
        self.binary=root/'bin/abrndrive'; self.binary.parent.mkdir(); self.binary.write_bytes(b'old backend')
        self.dist=root/'client/dist'; self.dist.mkdir(parents=True); (self.dist/'index.html').write_bytes(b'old')
        self.backups=root/'backups'; self.lock=root/'lock'; self.unit=root/'unit'; self.unit.write_text('[Service]\n')
        self.schemas=[f'{schema}:t']+([] if schema==50 else ['50:t']); self.actions=[]; self.active=True; self.goose=False; self.goose_dir=None
    def run(self,c,env=None,capture=False,private_log=None):
        x=Path(c[0]).name
        if private_log: Path(private_log).write_text('private\n'); Path(private_log).chmod(0o600)
        if x=='goose' and '-version' in c:
            if self.failure=='substitute':
                p=self.stage/'abrndrive'; p.chmod(0o600); p.write_bytes(b'evil'); p.chmod(0o500)
            return 'goose version: v3.28.0'
        if x=='psql':
            q=c[-1]
            if 'goose_db_version' in q:return self.schemas.pop(0)
            if 'to_regclass' in q:return 'false' if self.failure=='schema50' else 'true'
            if 'pg_database_size' in q:return '1024'
            if 'server_version' in q:return '16.4'
        if x=='pg_dump' and '--version' in c:return 'pg_dump 16.4'
        if x=='pg_restore' and '--version' in c:return 'pg_restore 16.4'
        if x=='pg_dump':
            if self.failure=='interrupt-pre':raise KeyboardInterrupt()
            if self.failure=='dump':raise subprocess.CalledProcessError(1,c)
            Path(c[c.index('--file')+1]).write_bytes(b'' if self.failure=='empty' else b'dump'); return ''
        if x=='pg_restore':
            if self.failure=='corrupt':raise subprocess.CalledProcessError(1,c)
            return ''
        if x=='goose':
            self.goose=True; self.goose_dir=Path(c[c.index('-dir')+1])
            if self.failure=='goose':raise subprocess.CalledProcessError(1,c)
            if self.failure=='interrupt-goose':raise SystemExit(130)
            return ''
        if x=='systemctl' and 'show' in c:return str(self.unit)
        raise AssertionError(c)
    def systemctl(self,a,check=True):self.actions.append(a); self.active=(a=='start')
    def json(self,url,timeout=5):
        if self.failure=='interrupt-probe':raise ri.ReleaseInterrupted('signal')
        if url.endswith('/ready'):return {'status':'ready','diagnostics':{'migrations':'ok (version: 50)'}}
        if self.failure=='public' and url.startswith('https'):raise ri.ReleaseError('public')
        return {'status':'ok','version':'abcdef1'}
    def asset(self,url,timeout=15):
        rel='dist/index.html'
        if url.endswith('.js'):rel='dist/assets/app.js'
        if url.endswith('.css'):rel='dist/assets/app.css'
        data=self.web[rel]
        if self.failure=='public-asset' and url.startswith('https'):data=b'bad'
        return data,('text/javascript' if rel.endswith('.js') else 'text/css' if rel.endswith('.css') else 'text/html')


@contextlib.contextmanager
def mocked(f):
    with contextlib.ExitStack() as s:
        s.enter_context(patch.multiple(ri,RUNTIME_ENV=f.runtime,BINARY_TARGET=f.binary,DIST_TARGET=f.dist,BACKUP_ROOT=f.backups,LOCK_PATH=f.lock))
        s.enter_context(patch.object(ri,'run',side_effect=f.run)); s.enter_context(patch.object(ri,'systemctl',side_effect=f.systemctl))
        s.enter_context(patch.object(ri,'service_is_active',side_effect=lambda:f.active)); s.enter_context(patch.object(ri,'fetch_json',side_effect=f.json)); s.enter_context(patch.object(ri,'fetch_asset',side_effect=f.asset))
        s.enter_context(patch.object(ri.os,'geteuid',return_value=0)); s.enter_context(patch.dict(ri.os.environ,{'SUDO_UID':str(f.stage.stat().st_uid)},clear=False)); yield


class Tests(unittest.TestCase):
    def test_literal_env_and_minimal_pg_env(self):
        with tempfile.TemporaryDirectory() as d,patch.dict(os.environ,{'PGOPTIONS':'evil','GOOSE_DRIVER':'evil'}):
            m=Path(d)/'m'; e=Path(d)/'e'; e.write_text(f'DB_URL="postgres://u:p%40ss@127.0.0.1:5432/vaultdrive"\nJWT_SECRET="$(touch {m})"\n')
            v=ri.parse_environment_file(e); self.assertFalse(m.exists()); pg=ri.postgres_environment(v['DB_URL']); self.assertEqual(pg['PGPASSWORD'],'p@ss'); self.assertNotIn('PGOPTIONS',pg); self.assertNotIn('GOOSE_DRIVER',pg)
    def test_extra_migration_rejected_before_stop(self):
        with tempfile.TemporaryDirectory() as d:
            f=Fx(Path(d)); md=f.stage/'migrations'; md.chmod(0o700); p=md/'051_evil.sql'; p.write_text('evil'); p.chmod(0o400); md.chmod(0o500)
            with mocked(f),self.assertRaises(ri.ReleaseError):ri.main(['x',str(f.stage)])
            self.assertEqual(f.actions,[]); self.assertFalse(f.goose)
    def test_symlink_and_writable_stage_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            r=Path(d); st,_=bundle(r); a=r/'alias'; a.symlink_to(st,True)
            with patch.object(ri,'BACKUP_ROOT',r/'b'),self.assertRaises(ri.ReleaseError):ri.snapshot_stage(a,os.getuid())
        with tempfile.TemporaryDirectory() as d:
            r=Path(d); st,_=bundle(r); (st/'abrndrive').chmod(0o620)
            with patch.object(ri,'BACKUP_ROOT',r/'b'),self.assertRaises(ri.ReleaseError):ri.snapshot_stage(st,os.getuid())
    def test_build_metadata_is_exact(self):
        for k,v in [('base_path','/q/'),('frontend_api_url','/abrn/api'),('agent_key_prefix','abrn_ak')]:
            with self.subTest(k=k),tempfile.TemporaryDirectory() as d:
                r=Path(d); st,_=bundle(r); p=st/'RELEASE.json'; p.chmod(0o600); j=json.loads(p.read_text());j[k]=v;p.write_text(json.dumps(j));p.chmod(0o400);refresh(st)
                with patch.object(ri,'BACKUP_ROOT',r/'b'): snap=ri.snapshot_stage(st,os.getuid())
                with self.assertRaises(ri.ReleaseError):ri.verify_bundle(snap)
    def test_frontend_missing_corrupt_extra_and_duplicate_rejected(self):
        for kind in ['missing','corrupt','extra']:
            with self.subTest(kind=kind),tempfile.TemporaryDirectory() as d:
                r=Path(d);st,web=bundle(r);changed=dict(web)
                if kind=='missing':changed.pop('dist/assets/app.js')
                elif kind=='corrupt':changed['dist/assets/app.js']=b'bad'
                else:changed['dist/extra']=b'x'
                p=st/'frontend-dist.tar';p.chmod(0o600)
                with tarfile.open(p,'w') as t:
                    for n,x in changed.items():i=tarfile.TarInfo(n);i.size=len(x);t.addfile(i,io.BytesIO(x))
                with self.assertRaises(ri.ReleaseError):ri.validate_frontend_archive(p,st/'FRONTEND-MANIFEST.sha256')
        with tempfile.TemporaryDirectory() as d:
            r=Path(d);m=r/'m';manifest(m,{'dist/index.html':b'x'});a=r/'a'
            with tarfile.open(a,'w') as t:
                for _ in range(2):i=tarfile.TarInfo('dist/index.html');i.size=1;t.addfile(i,io.BytesIO(b'x'))
            with self.assertRaises(ri.ReleaseError):ri.validate_frontend_archive(a,m)
    def test_schema_contract_and_version_gates(self):
        for x in ['false','','f']:
            with patch.object(ri,'run',return_value=x),self.assertRaises(ri.ReleaseError):ri.validate_schema_50({})
        for x in ['48:t','51:t','50:f','']:
            with patch.object(ri,'run',return_value=x),self.assertRaises(ri.ReleaseError):ri.schema_version({})
        with tempfile.TemporaryDirectory() as d:
            f=Fx(Path(d),'schema50',schema=50)
            with mocked(f),self.assertRaises(ri.ReleaseError):ri.main(['x',str(f.stage)])
            self.assertEqual(f.actions,[])
    def test_success_uses_snapshot_after_user_stage_substitution(self):
        with tempfile.TemporaryDirectory() as d:
            f=Fx(Path(d),'substitute')
            with mocked(f):self.assertEqual(ri.main(['x',str(f.stage)]),0)
            self.assertEqual(f.binary.read_bytes(),b'new backend');self.assertTrue(f.goose_dir.is_relative_to(f.backups));self.assertEqual(f.actions,['stop','start'])
    def test_runtime_mismatch_and_space_fail_before_stop(self):
        with tempfile.TemporaryDirectory() as d:
            f=Fx(Path(d));f.runtime.write_text('DB_URL="postgres://u:p@127.0.0.1:5432/vaultdrive"\nBASE_PATH="/abrn/"\nAGENT_KEY_PREFIX="abrn_ak"\n')
            with mocked(f),self.assertRaises(ri.ReleaseError):ri.main(['x',str(f.stage)])
            self.assertEqual(f.actions,[])
        with tempfile.TemporaryDirectory() as d:
            f=Fx(Path(d))
            with mocked(f),patch.object(ri,'ensure_free_space',side_effect=ri.ReleaseError('full')),self.assertRaises(ri.ReleaseError):ri.main(['x',str(f.stage)])
            self.assertEqual(f.actions,[])
    def test_backup_failures_restart_old_service_without_goose(self):
        for failure in ['dump','empty','corrupt']:
            with self.subTest(failure=failure),tempfile.TemporaryDirectory() as d:
                f=Fx(Path(d),failure)
                with mocked(f),self.assertRaises(BaseException):ri.main(['x',str(f.stage)])
                self.assertTrue(f.active);self.assertFalse(f.goose);self.assertEqual(f.binary.read_bytes(),b'old backend')
    def test_post_boundary_failures_stop_service(self):
        for failure in ['goose','public','public-asset']:
            with self.subTest(failure=failure),tempfile.TemporaryDirectory() as d:
                f=Fx(Path(d),failure)
                with mocked(f),self.assertRaises(BaseException):ri.main(['x',str(f.stage)])
                self.assertFalse(f.active);self.assertEqual(f.actions[-1],'stop')
    def test_interrupt_boundaries_cleanup(self):
        for failure,active in [('interrupt-pre',True),('interrupt-goose',False),('interrupt-probe',False)]:
            with self.subTest(failure=failure),tempfile.TemporaryDirectory() as d:
                f=Fx(Path(d),failure)
                with mocked(f),self.assertRaises(BaseException):ri.main(['x',str(f.stage)])
                self.assertEqual(f.active,active)
        with tempfile.TemporaryDirectory() as d:
            f=Fx(Path(d));original=ri.shutil.copyfile
            def boom(a,b,*x,**y):
                if str(b).endswith('release-new'):raise KeyboardInterrupt()
                return original(a,b,*x,**y)
            with mocked(f),patch.object(ri.shutil,'copyfile',side_effect=boom),self.assertRaises(KeyboardInterrupt):ri.main(['x',str(f.stage)])
            self.assertFalse(f.active)
    def test_lock_contention_and_cleanup_verification(self):
        with tempfile.TemporaryDirectory() as d,patch.object(ri,'LOCK_PATH',Path(d)/'l'):
            with ri.release_lock():
                with self.assertRaises(ri.ReleaseError):
                    with ri.release_lock():pass
        with patch.object(ri,'systemctl'),patch.object(ri,'service_is_active',return_value=True),self.assertRaises(ri.ReleaseError):ri.ensure_service_state(False)
    def test_isolated_python_ignores_sibling_module(self):
        with tempfile.TemporaryDirectory() as d:
            r=Path(d);mark=r/'owned';(r/'json.py').write_text(f'open({str(mark)!r},"w").write("x")')
            p=subprocess.run(['/usr/bin/python3','-I',str(Path(ri.__file__).resolve())],cwd=r,capture_output=True)
            self.assertNotEqual(p.returncode,0);self.assertFalse(mark.exists())
    def test_private_output_and_static_scope(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'l';ri.run([sys.executable,'-c','import sys;print("secret",file=sys.stderr)'],private_log=p);self.assertEqual(p.stat().st_mode&0o777,0o600)
        src=Path(ri.__file__).read_text();self.assertNotIn('shell=True',src);self.assertNotIn('quantixdrive.service',src)
        with patch.object(ri.sys,'version_info',(3,10)),self.assertRaises(ri.ReleaseError):ri.main(['x'])

if __name__=='__main__':unittest.main()
