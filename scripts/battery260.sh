#!/bin/bash
# Regression battery unit194–260 — exit codes are the only truth (5.255).
cd /home/z/my-project
PASS=0; FAIL=0; FAILED=""
for f in scripts/unit*.mjs; do
  bunx vite-node "$f" > /dev/null 2>&1
  code=$?
  if [ $code -eq 0 ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); FAILED="$FAILED $f($code)"; fi
done
echo "BATTERY: PASS=$PASS FAIL=$FAIL"
[ -n "$FAILED" ] && echo "FAILED:$FAILED"
exit $FAIL
