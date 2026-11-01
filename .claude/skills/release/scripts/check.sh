#!/bin/bash
# Typecheck, lint and unit tests; prints one line each, plus details only on failure.
cd "$(git rev-parse --show-toplevel)" || exit 2
status=0
if out=$(npx tsc --noEmit 2>&1); then echo "tsc   ✓"; else echo "tsc   ✗"; echo "$out" | head -20; status=1; fi
if out=$(npx expo lint 2>&1) && ! grep -qE "[0-9]+ (problem|error)" <<<"$out"; then echo "lint  ✓"; else echo "lint  ✗"; echo "$out" | grep -vE "^\s*$" | tail -20; status=1; fi
out=$(npx jest --silent 2>&1)
summary=$(grep -E "^Tests:" <<<"$out")
if grep -q "failed" <<<"$summary" || [ -z "$summary" ]; then echo "jest  ✗ $summary"; grep -E "●" -A12 <<<"$out" | head -40; status=1; else echo "jest  ✓ ${summary#Tests: }"; fi
exit $status
