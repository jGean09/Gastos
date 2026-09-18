# 01: Remove Duplicate `settle-modal` from HTML

**What to build:** 
Restore full functionality to the "Registrar Pix / Acerto Avulso" modal by removing the inaccessible duplicate DOM element that was hijacking input IDs. The user should be able to open the modal, fill in the inputs, and save without issues.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Remove the second `div` with `id="settle-modal"` in `index.html`
- [x] Verify that the "Registrar Pix" modal opens when clicked
- [x] Verify that saving a payment through the modal works correctly
