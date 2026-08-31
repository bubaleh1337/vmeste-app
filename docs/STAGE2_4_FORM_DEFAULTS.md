# Stage 2.4 — defaults for participant fields

- New savings default `contributorUserId` to the authenticated viewer.
- New expenses default `spentByUserId` to the authenticated viewer.
- The current user is marked with `(вы)` in those selectors.
- Existing transactions keep their stored participant when edited.
- Users can still select another active participant when entering a transaction on that person’s behalf.

No database migration is required.
