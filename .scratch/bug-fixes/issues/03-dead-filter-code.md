# 03: Remove dead code from History person-filter

**What to build:** 
Simplify the `renderHistory` filter logic in `app.js` by removing impossible `r.type === 'settlement'` branches, making the codebase easier to read and maintain for developers. The user experience remains unchanged.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Remove the ternary `r.type === 'settlement'` condition in the `him` and `her` filters inside `renderHistory`
- [x] Verify that the History view correctly filters by person (Só meus / Só dela)
