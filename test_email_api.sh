#!/bin/bash
# Test duplicate email account creation

set -e

echo "========================================="
echo "Email API Test Suite"
echo "========================================="
echo ""

# Get authentication token
echo "Test 0: Authenticating..."
TOKEN=$(curl -s -X POST https://dev-app.filemonprime.net/ABRN-Drive/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"v.cazares@abrn.mx","password":"Vx986532@@##$$"}' | jq -r .token)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ FAIL: Authentication failed"
  exit 1
fi

echo "✅ PASS: Authentication successful"
echo "   Token: ${TOKEN:0:20}..."
echo ""

# Test 1: Creating duplicate account (should return 409)
echo "Test 1: Creating duplicate account (should return 409)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  https://dev-app.filemonprime.net/ABRN-Drive/api/email/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"v.cazares@abrn.mx","imap_host":"mail.abrn.mx","imap_port":993,"imap_user":"v.cazares@abrn.mx","password":"test"}')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "409" ]; then
  echo "✅ PASS: Duplicate account returns 409"
  echo "   Response: $BODY"
  
  # Check if error message is user-friendly
  if echo "$BODY" | grep -q "Email account already exists"; then
    echo "✅ PASS: Error message is user-friendly"
  else
    echo "⚠️  WARN: Error message could be more user-friendly"
    echo "   Expected: 'Email account already exists'"
    echo "   Got: $BODY"
  fi
else
  echo "❌ FAIL: Expected 409, got $STATUS"
  echo "   Response: $BODY"
  exit 1
fi

echo ""

# Test 2: List email accounts (should include existing account)
echo "Test 2: Listing email accounts"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  https://dev-app.filemonprime.net/ABRN-Drive/api/email/accounts \
  -H "Authorization: Bearer $TOKEN")

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "200" ]; then
  echo "✅ PASS: List accounts returns 200"
  
  # Check if account exists
  if echo "$BODY" | grep -q "v.cazares@abrn.mx"; then
    echo "✅ PASS: Account v.cazares@abrn.mx found in list"
  else
    echo "❌ FAIL: Account not found in list"
    echo "   Response: $BODY"
    exit 1
  fi
else
  echo "❌ FAIL: Expected 200, got $STATUS"
  echo "   Response: $BODY"
  exit 1
fi

echo ""

# Test 3: Health check
echo "Test 3: Backend health check"
HEALTH=$(curl -s http://localhost:8081/healthz)

if echo "$HEALTH" | grep -q "ok"; then
  echo "✅ PASS: Backend is healthy"
else
  echo "❌ FAIL: Backend health check failed"
  echo "   Response: $HEALTH"
  exit 1
fi

echo ""
echo "========================================="
echo "All tests passed! ✅"
echo "========================================="
