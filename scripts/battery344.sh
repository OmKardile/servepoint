#!/bin/bash
# Task 344 regression battery — exit code is the only truth (5.255).
cd /home/z/my-project
PASS=0; FAIL=0; FAILED=""
for f in scripts/unit*.mjs; do
  if bunx vite-node "$f" >/dev/null 2>&1; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1)); FAILED="$FAILED $f"
  fi
done
echo "BATTERY: PASS=$PASS FAIL=$FAIL"
[ -n "$FAILED" ] && echo "FAILED:$FAILED"
exit $FAIL
