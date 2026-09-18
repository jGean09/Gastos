# 01: Category Limits Configuration

**What to build:** The ability to configure category limits per person while keeping old limits seamless. Migrate the data schema of `appSettings.goals.categories` from a single value to an object with `him` and `her`. In the UI, replace the single category input with a three-input row (Casal, Gean, Lu) containing logic that divides the Casal value 50/50 automatically when edited.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Update `appSettings.goals.categories` loading logic to seamlessly handle and migrate old number limits into `{ him, her }`.
- [x] Update `renderGoals` to output 3 input fields (`Casal`, `him`, `her`) per category instead of 1.
- [x] Implement `updateGoalCategory` logic to handle updates from any of the three inputs correctly (splitting the Casal amount or updating individual amounts).
