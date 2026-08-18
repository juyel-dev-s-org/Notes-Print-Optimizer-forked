## Summary

- **What**: one-line description of the change
- **Why**: problem/requirement this resolves
- **Evidence**: measured numbers (paired A/B) or verification performed

## Type of Change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (justify)
- [ ] Documentation update
- [ ] Performance improvement (attach before/after numbers)

## Scope

Files touched (paths), and whether behavior/outputs changed for end users.

## Verification (agent gate — run ALL)

- [ ] `npx tsc --noEmit` — exit 0
- [ ] `npm run lint` — clean
- [ ] `npm run test` — full suite green (241/241 at baseline HEAD)
- [ ] `npm run build` — succeeds (pre-existing warnings only)
- [ ] Golden outputs unchanged (0 byte-differences) if kernels/engine touched
- [ ] Tested on mobile viewport (Playwright smoke: 0 console errors,
      no horizontal overflow)
- [ ] SW/icon changes: `VERSION` bumped in `public/sw.js` if precache
      changed; icon renames are cache-busted (`-v2` style)
- [ ] Changelog entry added (CHANGELOG.md)
- [ ] Docs updated if behavior/config changed

## Notes for Reviewer

Anything the reviewer must know: env vars, base-path implications, deploy
ordering (this PR goes fork → production via merge).