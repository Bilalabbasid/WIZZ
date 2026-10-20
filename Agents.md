# AGENTS.md — WIZZ.PK

## Project identity

- Brand: WIZZ.PK
- Domain: wizz.pk
- Product: Pakistan-first ecommerce platform with multi-seller architecture.
- Default language: English.
- Default currency: PKR.
- Frontend and initial backend: Next.js App Router with TypeScript.
- Database: PostgreSQL.
- Preserve existing architectural decisions unless there is a documented reason to change them.

## Read before working

Before making changes:

1. Read this file and any applicable directory-level instructions.
2. Inspect the existing implementation.
3. Read PLAN.md, ARCHITECTURE.md, and DESIGN_SYSTEM.md when present.
4. Identify and read the relevant installed skills.
5. Implement the requested task without unrelated rewrites.

If project documents conflict with the actual implementation, investigate and document the resolution. Do not silently assume either is correct.

## Required skills

Read the actual SKILL.md and relevant references before applying a skill.

### frontend-design
Source: https://github.com/anthropics/skills

Use for:
- New page designs.
- Significant visual changes.
- Typography, layout, and brand direction.
- Visual review.

### ui-ux-pro-max
Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

Use for:
- Design-system decisions.
- Responsive layouts.
- Forms, tables, navigation, and dashboards.
- Interaction and usability improvements.

### storefront-best-practices
Source: https://github.com/medusajs/medusa-agent-skills

Use for:
- Product discovery.
- Product pages and variants.
- Cart and checkout.
- Customer shopping workflows.

This skill does not mandate using Medusa as the backend.

### vercel-react-best-practices
Source: https://github.com/vercel-labs/agent-skills

Use for:
- React and Next.js implementation.
- Data fetching and rendering.
- Performance improvements.
- Component refactoring.

### web-design-guidelines
Source: https://github.com/vercel-labs/agent-skills

Use for:
- UI audits.
- Accessibility.
- Form behavior.
- Keyboard and mobile interactions.

### Skill rules

- Use skills relevant to the current task; do not load every skill unnecessarily.
- Never claim a skill was used without reading it.
- If unavailable, report that limitation and inspect its official source when possible.
- Inspect installation instructions before installing missing skills.
- Do not execute unknown installation scripts blindly.
- Product requirements and explicit user instructions take precedence over skill defaults.
- frontend-design leads creative direction.
- ui-ux-pro-max maintains consistency and usability.
- storefront-best-practices guides shopping behavior.
- Vercel skills guide implementation quality and review.

## Delivery scope

Phase A:
- Complete first-party WIZZ.PK store.
- Customer accounts, catalog, inventory, checkout, and orders.
- Working platform administration.
- Seller-aware schema and authorization foundations.

Phase B:
- External seller onboarding.
- Seller product and inventory management.
- Seller order fulfillment.
- Moderation, commissions, returns, and settlements.

Represent WIZZ.PK itself as the first-party seller.

Keep unfinished external-seller capabilities behind server-enforced feature flags. Do not expose dead navigation or advertise unavailable functionality.

Do not simplify away requirements merely to finish faster. Record incomplete work honestly.

## Architecture rules

- Prefer a modular monolith.
- Keep business logic in server-side services.
- Reuse those services across API routes and Server Actions.
- Validate inputs at server boundaries.
- Use database constraints for critical invariants.
- Use transactions for related database changes.
- Define recovery and retries for external operations.
- Do not introduce microservices or replace frameworks without a concrete need.
- Verify APIs against documentation matching installed dependency versions.

## Design rules

Follow DESIGN_SYSTEM.md and reuse established components.

The storefront must feel like a distinctive retail brand:
- Prominent search.
- Useful category navigation.
- Strong product imagery.
- Clear pricing and availability.
- Visible seller and delivery information.
- Efficient mobile shopping.

Avoid:
- Generic SaaS landing-page layouts.
- Decorative gradient blobs.
- Excessive glass effects.
- Repeated filler sections.
- Identical card treatments for every content type.
- Excessive motion.
- Fake reviews, ratings, trust badges, or discounts.

Seller and admin interfaces should prioritize efficient work, clear status, readable tables, and useful bulk actions.

Implement loading, empty, error, disabled, and success states.

Every exposed control must work or clearly explain why it is unavailable.

## Seller isolation and permissions

- Derive seller context from authenticated membership.
- Never trust a browser-supplied seller ID as authorization.
- Enforce permissions on reads, writes, exports, imports, uploads, and reports.
- Apply the same checks to API routes and Server Actions.
- Sellers may access only their own permitted data.
- Customers may access only their own private records.
- Never expose other sellers’ suborders or unnecessary customer information.
- Public registration cannot grant platform-admin privileges.
- Record sensitive administrative actions in audit logs.
- Navigation visibility is not an authorization boundary.

## Commerce correctness

- Calculate prices, discounts, shipping, and totals on the server.
- Never trust client-submitted financial values.
- Use exact monetary arithmetic.
- Preserve immutable order-line and commission snapshots.
- Editing products must not alter historical orders.
- Use atomic stock checks and reservations.
- Define reservation expiry and release behavior.
- Prevent concurrent overselling.
- Make checkout, webhooks, refunds, and settlement operations idempotent.
- Validate state transitions explicitly.
- Reconcile parent-order and seller-suborder totals.
- Define rounding and allocation rules.
- Use traceable financial entries instead of arbitrary balance edits.

Payment redirects alone never prove payment.

COD fulfillment, collection, and remittance are separate states.

## Payments and integrations

- Verify provider availability and business-account eligibility before integration.
- Do not assume Stripe is available to the business.
- Use official provider documentation.
- Keep sandbox and production integrations separate.
- Disable unconfigured payment methods in production.
- Never simulate a successful live payment.
- Do not enable seller payouts without a supported operating model.
- Document required credentials and incomplete integrations.

## Security

- Validate and sanitize untrusted input.
- Sanitize rich product content.
- Scope file access and validate uploads.
- Protect authentication and sensitive actions against abuse.
- Use secure session handling and appropriate CSRF defenses.
- Verify webhook signatures and prevent duplicate processing.
- Keep secrets out of browser bundles, Git, and logs.
- Avoid unnecessary personal data in logs and responses.
- Never share-cache private customer or seller data.
- Use established security libraries rather than custom cryptography.

## SEO and performance

- Render indexable catalog content on the server where appropriate.
- Use accurate metadata, canonical URLs, and breadcrumbs.
- Structured data must match visible, real information.
- Include only eligible public pages in sitemaps.
- Keep private and transactional pages out of search indexes.
- Define a deliberate filter-page indexing policy.
- Optimize images and fonts.
- Minimize unnecessary client-side JavaScript.
- Invalidate caches when relevant catalog data changes.

## Testing

Run checks appropriate to the change.

Critical regression coverage includes:
- Seller isolation.
- Privilege escalation.
- Server-side pricing.
- Stock concurrency.
- Duplicate checkout submissions.
- Webhook retries.
- Partial refunds and cancellations.
- Commission reconciliation.

For UI changes:
- Inspect the running page when browser tools are available.
- Check mobile and desktop layouts.
- Verify keyboard access and focus.
- Inspect realistic edge cases.

Use isolated test data and sandbox integrations.

Never claim:
- A test passed when it did not run.
- An integration works without verification.
- A build proves all workflows work.
- The application is completely secure.

## Working process

- Deliver complete working slices.
- Preserve working functionality.
- Avoid unrelated dependency upgrades and refactors.
- Do not overwrite uncommitted user work.
- Ask only when a missing decision materially blocks correct implementation.
- Make reversible implementation choices autonomously and record assumptions.
- Never invent business facts, credentials, approvals, or test results.
- Fix confirmed issues within the requested scope.
- Keep PLAN.md updated after meaningful milestones.

Maintain:
- PLAN.md
- DESIGN_SYSTEM.md
- ARCHITECTURE.md
- SETUP.md
- .env.example with placeholders only

## Approval boundaries

Do not perform these actions without explicit authorization:
- Public deployment.
- Destructive production migrations.
- Deleting production data.
- Processing real payments or payouts.
- Sending messages to real customers.
- Changing production secrets.

Local development, isolated tests, and reversible implementation work may proceed within the requested scope.

## Completion report

After each meaningful task, report:

1. What changed.
2. What now works.
3. Checks actually run and their results.
4. Remaining blockers or limitations.
5. The next unfinished item, if any.

Be concise and factual. Completion claims must be supported by evidence.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
