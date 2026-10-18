# Engineering rules
- ET310 coverage uses a shared original parameterized case corpus for automated tests and live developer checks, so course certification reflects the same numerical evidence rather than a static label.
- RLC verification separates physical KCL/KVL/continuity residuals from finite-time settling; reject physical failures and withhold Verified status when endpoint residuals fail.
- Parallel voltage-step RLC is rejected until the source connection is explicitly modeled, because the previous finite-current assumption contradicted ideal-source physics.
- Run the entire automated suite after changes; production compilation is managed by the Lovable harness, and its latest build log must be checked before completion.