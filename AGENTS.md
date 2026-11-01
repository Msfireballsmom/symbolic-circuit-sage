# Engineering rules
- ET310 coverage uses a shared original parameterized case corpus for automated tests and live developer checks, so course certification reflects the same numerical evidence rather than a static label.
- RLC verification separates physical KCL/KVL/continuity residuals from finite-time settling; reject physical failures and withhold Verified status when endpoint residuals fail.
- RLC automatic horizons live in a pure settling module and must pass the unchanged solver audit; physically valid short runs show only waveforms/residuals with an audited extension action.
- Parallel voltage-step RLC is rejected until the source connection is explicitly modeled, because the previous finite-current assumption contradicted ideal-source physics.
- Run the entire automated suite after changes; production compilation is managed by the Lovable harness, and its latest build log must be checked before completion.
- Verify canonical DC with a separately implemented branch tableau, then KCL and power residuals; independent formulations catch stamping errors without trusting solver labels.
- Confirmed extraction is the only Snap solve path; missing fields and unsupported methods/components block the whole answer rather than dropping parts.
- The pure answer guard precedes certified presentation and completion metering: source-less operating-point questions are refused without blocking initial-conditioned transient questions or guessing resistance terminals.
- AI endpoints validate sessions, admin generation roles, bounded schemas and atomic service-only request budgets before calling the existing gateway; browser code never holds private credentials.
- Export verification defaults to unverified and is explicitly passed only by a checked result; escaped user content prevents executable export HTML.
- Visible unverified workflows are replaced by the central availability policy with no numerical or grading actions; server integrations stay disabled until authenticated end-to-end evidence exists.
- Confirmed network equivalents require an explicit output node; transient targets follow the storage element, and power requests return watts rather than branch current.

## Server-managed columns
- subscription_tier and stripe_customer_id on public.profiles are server-managed — clients hold no grant on these columns and a BEFORE UPDATE trigger rejects client changes; set them only from a service-role path (the Stripe webhook once billing is live).
- daily_solves.solve_count is incremented only through public.increment_daily_solve(); there is no client UPDATE grant.
- guest_solves has no client access and no operational code references it; its only code mention is the generated type declaration.