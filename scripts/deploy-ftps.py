#!/usr/bin/env python3
"""Publish an explicit SKAUT-only file list over verified FTPS; never mirror/delete.

Private credentials: IQHOST_CONFIG or ~/.config/iqhost/ftps.json.
Remote code backups and verification manifests stay outside Git.
"""
import concurrent.futures
import argparse
import datetime
import ftplib
import hashlib
import io
import json
import os
from pathlib import Path
import ssl
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
APP = '/skaut-app'
WEB = '/domains/skaut.korzeniowski.net/public_html'
CONFIG = Path(os.environ.get('IQHOST_CONFIG', '~/.config/iqhost/ftps.json')).expanduser()
BACKUP = Path.home() / '.config/iqhost/backups' / ('skaut-release-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))


def connect(config):
    f = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30)
    f.connect(config['host'], int(config.get('port', 21)))
    f.login(config['user'], config['password'])
    f.prot_p()
    return f


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only',nargs='+',help='Explicit repository paths or directories to publish from the fixed SKAUT allowlist')
    parser.add_argument('--workers',type=int,choices=[1,2,4],default=2,help='Parallel verified FTPS transfers')
    args=parser.parse_args()
    if CONFIG.stat().st_mode & 0o077:
        raise RuntimeError('Private FTP configuration must be owner-only.')
    config = json.loads(CONFIG.read_text())
    if config['host'] != 'host92093.iqhs.pl' or int(config.get('port', 21)) != 21:
        raise RuntimeError('Unexpected hosting target.')
    BACKUP.mkdir(parents=True, mode=0o700)
    # Explicit roots and file types; neither other domains nor private SQL state
    # are ever enumerated, downloaded, uploaded or removed by this publisher.
    public = [(p, WEB + '/' + p.relative_to(ROOT / 'public').as_posix())
              for p in sorted((ROOT / 'public').rglob('*')) if p.is_file()]
    runtime = [(ROOT / n, APP + '/' + n) for n in ['package.json', 'package-lock.json', 'passenger.cjs']]
    runtime += [(p, APP + '/' + p.relative_to(ROOT).as_posix())
                for folder in ['server', 'content'] for p in sorted((ROOT / folder).rglob('*')) if p.is_file()]
    runtime += [(ROOT / 'scripts' / n, APP + '/scripts/' + n) for n in ['admin.mjs', 'backup.mjs']]
    if args.only:
        selected=lambda item:any(item[0].relative_to(ROOT).as_posix()==name.rstrip('/') or item[0].relative_to(ROOT).as_posix().startswith(name.rstrip('/')+'/') for name in args.only)
        public=list(filter(selected,public))
        runtime=list(filter(selected,runtime))
        if not public and not runtime:
            raise RuntimeError('No selected file belongs to the fixed SKAUT allowlist.')
    files = public + runtime
    assert all(remote.startswith(WEB + '/') or remote.startswith(APP + '/') for _, remote in files)
    assert not any(Path(remote).name == '.htaccess' for _, remote in files)
    dirs = set()
    for _, remote in files:
        base = WEB if remote.startswith(WEB + '/') else APP
        parent = str(Path(remote).parent)
        while parent != base:
            dirs.add(parent)
            parent = str(Path(parent).parent)
    with connect(config) as f:
        for directory in sorted(dirs, key=lambda d: (len(Path(d).parts), d)):
            try:
                f.mkd(directory)
            except ftplib.error_perm:
                f.cwd(directory)
            f.sendcmd('SITE CHMOD 0755 ' + directory)
    sessions = threading.local()
    manifest = []
    lock = threading.Lock()

    def transfer(item):
        path, remote = item
        if not hasattr(sessions, 'ftp'):
            sessions.ftp = connect(config)
        f = sessions.ftp
        data = path.read_bytes()
        old = io.BytesIO()
        try:
            f.retrbinary('RETR ' + remote, old.write)
            if old.getvalue() == data:
                return {'path': remote, 'status': 'unchanged', 'sha256': hashlib.sha256(data).hexdigest()}
            backup_file = BACKUP / remote.lstrip('/')
            backup_file.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            backup_file.write_bytes(old.getvalue())
        except ftplib.error_perm as exc:
            if not str(exc).startswith('550'):
                raise
        temporary = remote + '.uploading'
        f.storbinary('STOR ' + temporary, io.BytesIO(data), blocksize=262144)
        f.sendcmd('SITE CHMOD 0644 ' + temporary)
        verify = io.BytesIO()
        f.retrbinary('RETR ' + temporary, verify.write, blocksize=262144)
        if verify.getvalue() != data:
            raise RuntimeError('Transfer verification failed: ' + remote)
        f.rename(temporary, remote)
        with lock:
            manifest.append(remote)
            if len(manifest) % 50 == 0:
                print('Uploaded and byte-verified:', len(manifest), flush=True)
        return {'path': remote, 'status': 'published', 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

    def publish(item):
        for attempt in range(3):
            try:
                return transfer(item)
            except (OSError, EOFError, ftplib.error_temp) as error:
                if hasattr(sessions,'ftp'):
                    sessions.ftp.close()
                    del sessions.ftp
                if attempt==2:
                    raise
                print('Reconnecting after interrupted transfer:',item[1],type(error).__name__,flush=True)
                time.sleep(1)

    # Assets and archive files precede the pages which reference them; runtime
    # activation happens only after all phases have been independently verified.
    results = []
    for batch in [[x for x in public if x[0].name not in ('app.js', 'index.html')],
                  [x for x in public if x[0].name in ('app.js', 'index.html')], runtime]:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            results.extend(pool.map(publish, batch))
    (BACKUP / 'manifest.json').write_text(json.dumps(results, indent=2))
    print('Verified', len(results), 'explicit SKAUT files. Private code backup:', BACKUP, flush=True)
    print('Application has not been restarted. Inspect manifest before activation.', flush=True)


if __name__ == '__main__':
    main()
