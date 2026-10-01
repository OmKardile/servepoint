#!/bin/bash
# One-off: verify the wizard provisioning path (tenant → subscription → audit)
# against the live project with the exact values the fixed app sends, then
# clean up so the owner's production DB stays pristine.
set -e
KEY="sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32"
BASE="https://gehjsxopcowmotgrrcgc.supabase.co"

TOKEN=$(curl -s --max-time 10 -X POST "$BASE/auth/v1/token?grant_type=password" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"admin@tsos.dev","password":"admin123456"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
AUTH=(-H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Prefer: return=representation")

echo "1) INSERT tenant (status: trial)"
TENANT=$(curl -s -X POST "$BASE/rest/v1/tenants" "${AUTH[@]}" -d '{
  "name":"Wizard Verification","slug":"wizard-verification","business_type":"cafe",
  "status":"trial","city":"Bengaluru","owner_email":"admin@tsos.dev"}')
TENANT_ID=$(echo "$TENANT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if isinstance(d,list) else 'ERR:'+str(d)[:200])")
echo "   tenant_id: $TENANT_ID"
[ "$TENANT_ID" = "ERR" ] && exit 1 || true

echo "2) INSERT subscription (starter / trialing)"
curl -s -X POST "$BASE/rest/v1/subscriptions" "${AUTH[@]}" -d "{
  \"tenant_id\":\"$TENANT_ID\",\"plan_id\":\"starter\",\"billing_cycle\":\"monthly\",
  \"monthly_price\":0,\"final_monthly_rate\":0,\"status\":\"trialing\"}" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('   sub:',d[0]['status'],d[0]['plan_id'])"

echo "3) INSERT audit log (business.provisioned)"
curl -s -X POST "$BASE/rest/v1/platform_audit_logs" "${AUTH[@]}" -d "{
  \"tenant_id\":\"$TENANT_ID\",\"actor_email\":\"admin@tsos.dev\",
  \"action\":\"business.provisioned\",
  \"details\":\"Wizard Verification (wizard-verification) · plan trial · owner admin@tsos.dev\",
  \"metadata\":{\"slug\":\"wizard-verification\",\"plan\":\"trial\"}}" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('   audit:',d[0]['action'],'·',d[0]['details'][:50])"

echo "4) READ back (Platform console queries)"
curl -s "$BASE/rest/v1/tenants?select=name,status" "${AUTH[@]}" | python3 -c "import sys,json;print('   tenants:',json.load(sys.stdin))"
curl -s "$BASE/rest/v1/platform_audit_logs?select=action,details&order=timestamp.desc&limit=5" "${AUTH[@]}" | python3 -c "import sys,json;print('   audit:',json.load(sys.stdin))"

echo "5) CLEANUP (restore pristine production DB)"
curl -s -X DELETE "$BASE/rest/v1/platform_audit_logs?tenant_id=eq.$TENANT_ID" "${AUTH[@]}" -o /dev/null -w "   audit deleted: %{http_code}\n"
curl -s -X DELETE "$BASE/rest/v1/subscriptions?tenant_id=eq.$TENANT_ID" "${AUTH[@]}" -o /dev/null -w "   subscription deleted: %{http_code}\n"
curl -s -X DELETE "$BASE/rest/v1/tenants?id=eq.$TENANT_ID" "${AUTH[@]}" -o /dev/null -w "   tenant deleted: %{http_code}\n"
curl -s "$BASE/rest/v1/tenants?select=*" "${AUTH[@]}" | python3 -c "import sys,json;print('   final tenants:',json.load(sys.stdin))"
echo "VERIFICATION COMPLETE"
