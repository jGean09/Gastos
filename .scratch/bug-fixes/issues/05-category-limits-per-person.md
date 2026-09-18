# 05: Category Limits per Person and Top Expenses Visualization

## Problem Statement

The user and their partner need a more granular way to track and limit spending. Currently, the app allows setting a category limit for the couple as a whole and a single global limit per person. The problem is that spending habits are often asymmetric within categories (e.g., one spends more on transport, the other on snacks). They need a way to set category limits specifically per person to accurately organize their budget and know who consumed what. Additionally, they want the "Top Expenses" visualization to clearly indicate who made each top purchase.

## Solution

We will introduce category limits separated by person. In the "Metas" settings, each category will display three inputs: a couple's sum, a limit for "him" (Gean), and a limit for "her" (Luciana). Typing in the couple's input splits the value 50/50, while individual adjustments only affect the respective person's limit and recalculate the sum. The category progress bars will display two separate mini-bars. The "Onde vocês mais gastaram" view will remain a single list but will include colored dots to identify the payer and a subtitle indicating the category. Global limits per person will remain completely independent.

## User Stories

1. As a user, I want to set a specific spending limit for myself for a specific category, so that I can budget for categories where I spend more than my partner.
2. As a user, I want to set a specific spending limit for my partner for a specific category, so that their budget reflects their distinct spending habits.
3. As a user, I want to type a total couple limit for a category and have it automatically split 50/50, so that I can quickly set up shared budget categories.
4. As a user, I want to see two separate mini progress bars for each category, so that I can easily see if I or my partner have exceeded our individual category quotas.
5. As a user, I want to set my own global monthly goal independently from the sum of my categories or my partner's goal, so that I have flexibility in my overall budget constraint.
6. As a user, I want to see colored dots next to top expenses in the "Onde vocês mais gastaram" list, so that I can immediately identify who made the largest purchases.
7. As a user, I want to see the category of each top expense as a subtitle, so that I have context on where that money went.

## Implementation Decisions

- **`appSettings.goals.categories` schema update**: Change from storing a single integer `categories[key] = limitCents` to an object `categories[key] = { him: limitHim, her: limitHer }`.
- **Backward Compatibility**: When loading an old `categories[key]` which is a number, we will dynamically split it 50/50 to `him` and `her` to migrate seamlessly without data loss.
- **UI for Metas configuration (`renderGoals`)**: Replace the single category input with a three-input row (`Casal`, `Gean`, `Lu`).
- **UI for Category Progress (`renderGoals`)**: Replace the single `goalBar(spentCat[key], limitCents)` with two distinct `goalBar` components stacked vertically per category, using `--him` and `--her` colors.
- **UI for Top Expenses (`renderReport`)**: Update the `storeRows` map function. It currently aggregates expenses by `storeMap[r.store] = { himC, herC }`. We will update the `storeMap` tracking logic to also include the primary category of that store. Then, we render a colored dot (🔵 for `him`, 🔴 for `her`) based on the payer, and a subtitle with the category.

## Testing Decisions

- Ensure the UI responds correctly to typing in the `Casal` input (divides by 2 and updates individual inputs).
- Ensure typing in individual inputs correctly sums up the `Casal` value.
- Ensure the top expenses show correct colored dots and subtitles.
- Ensure old data models (single integer category limits) gracefully fall back without crashing.
- Modules tested: `app.js` (`renderGoals`, `updateGoalCategory`, `renderReport`).

## Out of Scope

- Creating brand new screens for goals.
- Changing the sync logic or Firebase backend structure (the `appSettings` JSON update handles the schema change automatically).

## Further Notes

- The user requested this via a grilling session to refine the UX details.
