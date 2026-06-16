# GSTR-1 Mark Dashboard

This app is configured for the GSTR-1 workflow:

- Spreadsheet ID: `13yOxJe9Tv7v6dmlZ3pybYTClQjiU3WnvOYonAL5KSBU`
- Source sheet: `DB Format`
- Completion storage: your connected Apps Script / Data sheet

Current behavior:

- Login validates the email against `Final Doer Email`.
- Each client/project shows all stages together.
- Every pending stage has a **Tick Mark** button.
- Each client/project has a **Not Applicable? Submit 12th Stage** button.
- The 12th-stage button lets you directly complete the 12th/final stage when earlier stages are not applicable.

The Google Apps Script URL is already hardcoded in `src/App.tsx`, so users do not need to paste any URL in the dashboard.