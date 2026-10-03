#!/usr/bin/env python3
"""Task 163: find the failed-drill residue (auth user + any local-only rows).
READ-ONLY probe first — prints what exists for drill.owner@recoverydrill.in."""
import os, json, urllib.request

URL = 'https://gehjsxopcowmotgrrcgc.supabase.co'
KEY = None
# pull the publishable key from the source (it is the public client key)
src = open('/home/z/my-project/src/lib/supabase.ts').read()
for line in src.splitlines():
    if 'HARDCODED_SUPABASE_ANON_KEY' in line and '=' in line and 'sb_' in line:
        KEY = line.split("'")[1]
if not KEY:
    raise SystemExit('no key')

def rest(path):
    req = urllib.request.Request(URL + path, headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# tenants (should be 2 — drill must NOT have a tenant row)
s, b = rest('/rest/v1/tenants?select=id,name,slug,city,status&order=created_at.asc')
print('TENANTS', s)
for t in json.loads(b):
    print('  ', t.get('name'), '/', t.get('slug'), '/', t.get('city'), '/', t.get('status'))

# local registry check happens in-browser; here just note cloud absence
s, b = rest('/rest/v1/tenant_users?select=email,role&email=eq.drill.owner@recoverydrill.in')
print('TENANT_USERS drill.owner:', s, b[:120])
