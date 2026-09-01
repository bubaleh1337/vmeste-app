# Vmeste 0.14.1 hotfix

Fixes Halyk current-account/card PDF expense import on mobile browsers.

Changes:
- feature-detected PDF.js cleanup so Safari/WKWebView cleanup differences cannot discard a successful parse;
- avoids String.prototype.matchAll in currency detection for broader iOS/WKWebView compatibility;
- parses Halyk current-account PDF columns (posting date, processing date, operation amount, account credit/debit, commission);
- imports only debit rows when the target is Expenses;
- joins wrapped Halyk merchant descriptions;
- retains the existing Halyk EUR savings parser and generic bank parser;
- adds regression tests against the real statement layout.

No database migration and no new npm dependency are required.
