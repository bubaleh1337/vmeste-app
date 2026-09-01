# Update 4.3.1

Fixes language persistence and cross-page consistency. No SQL migration and no new npm dependencies are required.

Rules:
- for signed-in users, the locale saved in the profile is the single source of truth on every authenticated page;
- on the first visit/setup, English is selected only when the browser/system language is English; otherwise Russian is used;
- manual switching persists the choice to both the profile and browser cookie;
- switching performs a full navigation to clear stale Next.js route state, so one page cannot remain in the previous language.
