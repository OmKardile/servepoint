#!/usr/bin/env python3
"""Task 163: daemonize the Vite dev server via double-fork so it survives
the tool-session process reaper. Idempotent: skips if port 3000 is live."""
import os, sys, socket, time, subprocess

def port_live(host='127.0.0.1', port=3000):
    s = socket.socket()
    s.settimeout(1.5)
    try:
        s.connect((host, port))
        return True
    except OSError:
        return False
    finally:
        s.close()

if port_live():
    print("ALREADY RUNNING")
    sys.exit(0)

def fork():
    pid = os.fork()
    if pid > 0:
        os._exit(0)

fork()           # fork 1
os.setsid()      # new session — escapes the shell's process group
fork()           # fork 2 — grandchild reparented to init
os.chdir('/home/z/my-project')
dev = open('/home/z/my-project/dev.log', 'ab')
err = open('/home/z/my-project/dev.err.log', 'ab')
for fd in (0, 1, 2):
    try:
        os.dup2(err.fileno() if fd == 2 else dev.fileno(), fd)
    except Exception:
        pass
subprocess.run(['npm', 'run', 'dev'], check=False)

