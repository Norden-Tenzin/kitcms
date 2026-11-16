#!/usr/bin/env bash
# SPIKE (Phase 0): curl-based smoke test for the kitcms auth flows (Better Auth on D1).
#
#   BASE=http://localhost:5173 DOC_ID=smoke-doc ./kitcms-spike/auth-smoke.sh
#   BASE=https://kitcms-dev.<acct>.workers.dev DOC_ID=smoke-doc ./kitcms-spike/auth-smoke.sh
#
# Preconditions: the `user` table is empty, and a `pages` row with id $DOC_ID and title 'smoke-original' exists
# (seed it with `wrangler d1 execute DB --local|--remote --command "insert into pages ..."`).
# Prints a PASS/FAIL line per check and the actual Set-Cookie headers. Exit code != 0 on any failure.
set -u

BASE="${BASE:?set BASE, e.g. http://localhost:5173}"
BASE="${BASE%/}"
DOC_ID="${DOC_ID:-smoke-doc}"
EMAIL="${EMAIL:-smoke-admin@example.com}"
PASSWORD="${PASSWORD:-smoke-password-123}"
EVIL="https://evil.example.org"
JAR="$(mktemp)"
trap 'rm -f "$JAR" "$JAR.out" "$JAR.hdr"' EXIT

FAILS=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1  ($2)"; FAILS=$((FAILS + 1)); }
expect_code() { # name actual expected...
	local name="$1" actual="$2"; shift 2
	for want in "$@"; do [ "$actual" = "$want" ] && { pass "$name -> $actual"; return; }; done
	fail "$name" "got $actual, want $*"
}

# req METHOD URL [curl args...]  -> sets CODE, BODY (file $JAR.out), HDR (file $JAR.hdr); never follows redirects
req() {
	local method="$1" url="$2"; shift 2
	CODE=$(curl -s -o "$JAR.out" -D "$JAR.hdr" -w '%{http_code}' -X "$method" "$url" "$@")
}
location() { grep -i '^location:' "$JAR.hdr" | tr -d '\r' | awk '{print $2}'; }
setcookies() { grep -i '^set-cookie:' "$JAR.hdr" | tr -d '\r'; }
form_post() { # path origin fields...
	local path="$1" origin="$2"; shift 2
	local args=()
	for f in "$@"; do args+=(--data-urlencode "$f"); done
	req POST "$BASE$path" -H "Origin: $origin" -H "Accept: text/html" -b "$JAR" -c "$JAR" ${args[@]+"${args[@]}"}
}

echo "== base: $BASE"

echo "-- 1. signed out"
req GET "$BASE/admin/collections/pages"
expect_code "unauthenticated GET /admin/collections/pages redirects" "$CODE" 303
echo "      location: $(location)"
case "$(location)" in *create-first-user) pass "no users -> create-first-user";; *) fail "no users -> create-first-user" "$(location)";; esac

form_post "/admin/collections/pages/$DOC_ID?/save" "$BASE" "title=pwned-by-unauthenticated"
expect_code "unauthenticated POST ?/save rejected" "$CODE" 401 403 303
echo "      location: $(location)"

echo "-- 2. public sign-up is closed"
req POST "$BASE/api/auth/sign-up/email" -H "Origin: $BASE" -H 'content-type: application/json' \
	-d "{\"email\":\"intruder@example.com\",\"password\":\"intruder-pass-123\",\"name\":\"Intruder\",\"role\":\"admin\"}"
expect_code "POST /api/auth/sign-up/email blocked" "$CODE" 400 403 404
echo "      body: $(head -c 200 "$JAR.out")"

echo "-- 3. first user"
form_post "/admin/create-first-user?/createFirstUser" "$EVIL" "name=Evil" "email=evil@example.com" "password=evil-password-123"
expect_code "cross-origin createFirstUser blocked" "$CODE" 403

form_post "/admin/create-first-user?/createFirstUser" "$BASE" "name=Smoke Admin" "email=$EMAIL" "password=$PASSWORD" "role=editor"
expect_code "createFirstUser (same origin, client-supplied role=editor ignored)" "$CODE" 303
echo "      location: $(location)"
echo "      Set-Cookie:"; setcookies | sed 's/^/        /'
case "$(setcookies)" in *HttpOnly*) pass "session cookie is HttpOnly";; *) fail "session cookie HttpOnly" "missing";; esac
case "$(setcookies)" in *[Ss]ame[Ss]ite=Lax*) pass "session cookie SameSite=Lax";; *) fail "session cookie SameSite=Lax" "missing";; esac
case "$BASE" in https://*) case "$(setcookies)" in *Secure*) pass "session cookie Secure over https";; *) fail "session cookie Secure over https" "missing";; esac;; esac

req GET "$BASE/api/auth/get-session" -b "$JAR"
ROLE=$(grep -o '"role":"[a-z]*"' "$JAR.out" | head -1)
[ "$ROLE" = '"role":"admin"' ] && pass "first user has role admin ($ROLE)" || fail "first user role" "$ROLE / $(head -c 200 "$JAR.out")"
grep -qiE 'password|hash' "$JAR.out" && fail "get-session leaks credentials" "$(head -c 200 "$JAR.out")" || pass "get-session carries no password/hash"

echo "-- 4. second first-user is blocked"
SECOND_JAR="$(mktemp)"
CODE=$(curl -s -o "$JAR.out" -D "$JAR.hdr" -w '%{http_code}' -X POST "$BASE/admin/create-first-user?/createFirstUser" \
	-H "Origin: $BASE" -H "Accept: text/html" -c "$SECOND_JAR" --data-urlencode "name=Second" --data-urlencode "email=second@example.com" --data-urlencode "password=second-password-123")
# fail(403) re-runs `load`, which redirects a signed-out visitor to login (303) when users exist.
expect_code "second createFirstUser fails (users exist)" "$CODE" 403 303
[ -z "$(setcookies)" ] && pass "no cookie issued" || fail "no cookie issued" "$(setcookies)"
rm -f "$SECOND_JAR"
CODE=$(curl -s -o "$JAR.out" -w '%{http_code}' -X POST "$BASE/api/auth/sign-in/email" -H "Origin: $BASE" -H 'content-type: application/json' \
	-d '{"email":"second@example.com","password":"second-password-123"}')
expect_code "second user was not created (sign-in fails)" "$CODE" 401 400

echo "-- 5. admin access with session"
req GET "$BASE/admin" -b "$JAR"
expect_code "GET /admin signed in" "$CODE" 200
grep -q "$EMAIL" "$JAR.out" && pass "admin shows signed-in user" || fail "admin shows signed-in user" "no email in page"
grep -qiE 'password|"token"' "$JAR.out" && fail "admin page leaks credentials" "found password/token" || pass "admin page data has no password/token"
req GET "$BASE/admin/login" -b "$JAR"
expect_code "signed-in GET /admin/login bounces" "$CODE" 303
req GET "$BASE/admin/create-first-user" -b "$JAR"
expect_code "signed-in GET /admin/create-first-user bounces" "$CODE" 303

echo "-- 6. role cannot be set by a client"
req POST "$BASE/api/auth/update-user" -H "Origin: $BASE" -H 'content-type: application/json' -b "$JAR" -d '{"name":"Renamed","role":"editor"}'
echo "      update-user -> $CODE $(head -c 160 "$JAR.out")"
req GET "$BASE/api/auth/get-session" -b "$JAR"
ROLE=$(grep -o '"role":"[a-z]*"' "$JAR.out" | head -1)
[ "$ROLE" = '"role":"admin"' ] && pass "role unchanged after update-user with role=editor" || fail "role changed" "$ROLE"

echo "-- 7. cross-origin save is blocked, same-origin save works"
form_post "/admin/collections/pages/$DOC_ID?/save" "$EVIL" "title=pwned-cross-origin"
expect_code "cross-origin ?/save with valid session blocked" "$CODE" 403
req POST "$BASE/admin/collections/pages/$DOC_ID?/save" -H "Accept: text/html" -b "$JAR" --data-urlencode "title=pwned-no-origin"
expect_code "?/save without Origin header blocked" "$CODE" 403
req GET "$BASE/admin/collections/pages/$DOC_ID" -b "$JAR"
grep -q 'smoke-original' "$JAR.out" && pass "document unchanged by blocked/unauthenticated saves" || fail "document unchanged" "title not 'smoke-original'"
form_post "/admin/collections/pages/$DOC_ID?/save" "$BASE" "title=smoke-original"
expect_code "same-origin ?/save with session" "$CODE" 200 303

echo "-- 8. login / logout"
CODE=$(curl -s -o "$JAR.out" -w '%{http_code}' -X POST "$BASE/admin/login?/login" -H "Origin: $BASE" -H "Accept: text/html" \
	--data-urlencode "email=$EMAIL" --data-urlencode "password=wrong-password-xx")
expect_code "login with wrong password fails (no session)" "$CODE" 400
grep -q 'Invalid email or password' "$JAR.out" && pass "generic error message" || fail "generic error message" "not shown"
form_post "/admin?/logout" "$EVIL" "_=1"
expect_code "cross-origin logout blocked" "$CODE" 403
req GET "$BASE/admin" -b "$JAR"
expect_code "session still valid after blocked logout" "$CODE" 200
OLD_COOKIE=$(awk '$6 ~ /session_token/ {print $6"="$7}' "$JAR")
form_post "/admin?/logout" "$BASE" "_=1"
expect_code "logout" "$CODE" 303
echo "      location: $(location)"
echo "      Set-Cookie:"; setcookies | sed 's/^/        /'
req GET "$BASE/admin/collections/pages" -b "$JAR"
expect_code "after logout, admin redirects" "$CODE" 303
case "$(location)" in *login) pass "-> login";; *) fail "-> login" "$(location)";; esac
req GET "$BASE/admin" -H "Cookie: $OLD_COOKIE"
expect_code "replaying the old session cookie after logout is rejected (server-side revocation)" "$CODE" 303

CODE=$(curl -s -o "$JAR.out" -D "$JAR.hdr" -w '%{http_code} total=%{time_total}s' -X POST "$BASE/admin/login?/login" \
	-H "Origin: $BASE" -H "Accept: text/html" -c "$JAR" --data-urlencode "email=$EMAIL" --data-urlencode "password=$PASSWORD")
echo "      login timing: $CODE"
expect_code "login with correct password" "${CODE%% *}" 303
req GET "$BASE/admin" -b "$JAR"
expect_code "GET /admin after login" "$CODE" 200

echo "-- 9. public routes"
req GET "$BASE/"
expect_code "GET / (public) needs no session" "$CODE" 200 404

echo
[ "$FAILS" = 0 ] && echo "ALL CHECKS PASSED" || echo "$FAILS CHECK(S) FAILED"
exit "$FAILS"
