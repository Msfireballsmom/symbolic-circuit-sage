# Production-readiness audit
- [x] Audit visible math, parsing, generation, homework, admin, saved and export paths; remove fabricated claims.
- [x] Block ambiguous/unsupported confirmed answers and add focused numerical/input regressions.
- [x] Harden configured AI functions; deployed invalid-session checks return 401. Test Pro local solve controls exercised.
- [x] Run full suite, independent ET310 corpus and matrix; check harness build and report evidence and limitations.
- [ ] Verify authenticated real-photo extraction and administrator generation/history end-to-end. Blocker: no real authenticated student/admin session or photo supplied; Test Pro deliberately cannot call paid APIs.