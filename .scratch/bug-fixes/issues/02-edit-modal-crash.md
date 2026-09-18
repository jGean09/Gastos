# 02: Fix `openEditModal` crash on itemless receipts

**What to build:** 
Allow users to tap the edit button on settlements, rollovers, and personal-panel entries without the app silently crashing due to a missing `items` array. The edit modal should open and display the receipt's general details.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Add a `|| []` fallback for `receipt.items` in `openEditModal` inside `app.js`
- [x] Ensure that clicking edit on a settlement or rollover opens the modal successfully with an empty item list
