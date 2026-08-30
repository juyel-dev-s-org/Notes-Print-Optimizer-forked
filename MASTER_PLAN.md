# MASTER_PLAN.md — Full Ownership Roadmap (v2)

> Juyel has given full creative/technical authority: complete redesign,
> 15+ new features, full i18n, scalability architecture. This document
> makes the actual decisions — it does not ask more questions. Every
> "current state" claim was verified by reading the real code (see
> PROGRESS.md / PLAN.md v1 for the earlier audit trail this builds on).

---

## PART A — Design system decisions (final, not up for debate)

**Verdict on color: keep emerald as the base hue, but build a real
system around it instead of one flat green.** Rationale: emerald is
already the declared "main brand" in the codebase, I already spent real
effort this session making the whole app consistently emerald (header,
icons, mask-icon) — reversing that now would be the exact kind of
thrashing Juyel is rightly tired of from prior AI agents. The problem was
never the hue; it's that everything using ONE color with no hierarchy
reads as flat/generic. A senior system fixes that with structure, not a
new paint color.

**The actual system:**
- **Brand (emerald→teal→cyan gradient)** — stays exactly where it is:
  logo, primary CTAs, active states, headline accents.
- **NEW: a warm accent (amber/coral, ~`#F59E0B`→`#FB7185`)** — used
  *sparingly* for things that must visually interrupt the green wash:
  streaks/achievements, "new" badges, the sponsor banner, urgent
  countdown widgets. This single addition does more for "looks premium"
  than any hue swap would.
- **Semantic colors separated from brand** — success/warning/danger/info
  get their own tokens instead of reusing brand-emerald for "success" and
  a random red for "danger" ad hoc per component (checked: this
  inconsistency exists today).
- **One elevation/shadow scale**, defined once, reused everywhere instead
  of every component inventing its own glass-blur values (the footer,
  hero, and cards each currently hand-roll slightly different
  glass/shadow recipes).
- **Typography**: keep Plus Jakarta Sans as the workhorse (it's a good,
  legible, modern choice — no reason to add font-loading cost by
  swapping). Add one deliberate *display* treatment (heavier weight,
  tighter tracking, used only for hero numbers/big headlines) so the
  brand has a recognizable "voice" beyond just color.
- **A signature shape motif** — a small recurring visual detail (e.g. a
  torn-notebook-corner / dog-ear) reused across empty states, loading
  screens, and the app icon, so a screenshot is recognizable as this
  product even without the logo visible.

**Icon verdict:** recolor the existing shape to the emerald system rather
than commissioning an entirely new concept — the current glyph
(notebook/document mark) is a fine, appropriate concept; only its color
is wrong. I'll produce this directly (it's a solvable design-asset task,
not a decision I need Juyel's taste for).

**Header verdict:** hamburger **stays**, but scope is corrected — it
should hold *secondary* things only (Settings, Language, Feedback,
About/Legal, Install prompt), matching what's already in
`menuRegistry`/`SettingsDrawer` today (that part is already right).
Primary tool discovery must never require opening it — the homepage
searchable grid already does this correctly and stays as the main nav
model.

**Footer verdict:** the existing footer (checked in full) is structurally
already good — glass card, real column layout, social row. It does NOT
need a rebuild. It needs three honest fixes:
1. The **language toggle pill (HI/EN) currently does nothing** — it's
   decorative, no real switching logic exists yet. Either wire it to real
   i18n (Part C) or remove it until it's real — a fake toggle is worse
   than no toggle.
2. **Instagram and X icons link to `href="#"`** — dead placeholders. Fix
   with real URLs once they exist, or remove the icons until they do.
3. The "Legal" menu link currently works by simulating clicks on other
   DOM elements with a hardcoded 300ms timeout guess — it works, but it's
   fragile (breaks silently if the menu's internal markup ever changes).
   Replace with a direct, real link/state instead of DOM-timing tricks.

**Hero verdict:** keep the layout, do a copy + trust-signal pass. The
"Trusted by 50,000+ Students" stat is unverifiable/likely invented — I
will not carry forward a fabricated number. Replace it with an honest,
arguably *more* compelling trust signal for this exact audience:
**"Your notes never leave your phone"** as the lead badge, since privacy
is a real, checkable claim (it's actually true — everything runs
on-device) and resonates with cautious parents/coaching centers more than
an invented user count would.

---

## PART B — 15+ new features (prioritized, concrete, buildable)

Ranked by (audience value × buildability), not just novelty:

**Tier 1 — build first, highest leverage for the actual audience:**
1. **Share-to-app target** — Print Optimizer becomes a destination in the
   phone's native Share sheet, so a scanned PDF from WhatsApp/Drive/
   Camera-scanner apps opens directly into the right tool. Real PWA
   capability, not vapourware, and removes the single biggest friction
   point (download → find file → re-open in browser).
2. **Remembered per-tool presets** — "always N-up 4, A4, borders on"
   persisted locally (no account needed) so repeat users during exam
   season hit zero friction after the first use.
3. **Recent files (local-only)** — "continue where you left off," nothing
   uploaded anywhere, matches the existing privacy promise instead of
   contradicting it.
4. **Batch mode** — run one tool across multiple files in one pass
   (a student often has a week's scans at once, not one file).
5. **Study Pack Builder** — chain tools in one flow (merge → whiten →
   N-up → done) instead of making students manually redo upload/download
   between each tool, which is almost certainly how they use it today.

**Tier 2 — strong differentiators for this specific audience:**
6. **Searchable-text overlay for scanned notes** (OCR via a WASM engine,
   matching the app's existing on-device-compute architecture) — turn a
   photographed page into something you can Ctrl+F.
7. **Smart tool suggestion on upload** — detect a dark photo → suggest
   Dark Notes→Print; detect multiple images → suggest Merge or
   Image→PDF — cuts the "which of 12 tools do I want" decision.
8. **QR-linked printouts** — print a physical sheet with a small QR that
   reopens/redownloads the source PDF — natural extension of the
   already-built QR Studio tool.
9. **PDF size/ink-cost estimate** — show "this will use ~X ml ink /
   costs ~₹Y at a shop" before printing — a genuinely new, very
   student-relevant number to show (more useful than a vanity stat).
10. **Exam-date aware widgets** — a small, static (no backend needed)
    NEET/JEE/UPSC countdown, since the app's whole reason to exist is
    tied to these dates.

**Tier 3 — polish / retention / trust:**
11. **Install-prompt timing tuned to success**, not immediately on load
    (prompt after a completed conversion, when trust is highest).
12. **Post-success feedback nudge** (not a popup — a quiet inline
    "was this helpful?") — gives Juyel real usage signal instead of
    inventing stats.
13. **Accessibility mode** — larger touch targets + high-contrast
    variant, beyond the current light/dark toggle.
14. **Dark-mode-aware in-app PDF preview** for late-night sessions.
15. **File-size compressor** as its own tool — complements the existing
    "save ink" positioning with "save storage/data," both real
    low-end-phone concerns.
16. **Coaching-institute-tuned presets** (e.g. defaults calibrated to
    common PW/Allen/Unacademy PDF export quirks) — also the natural seam
    for a future sponsor/partnership relationship if that's ever pursued.
17. **Multi-file page-thumbnail reordering unified across tools** (exists
    per-tool already in places; worth one shared, consistent component).
18. **Sponsor/partner banner** (originally requested) — real reusable
    auto-swipe + dot-indicator carousel component, config-driven (a
    plain list of name/logo/link/copy) so Juyel can add a sponsor without
    needing a code change each time.

I will build these roughly in the tier order above, one at a time,
each with its own tests — not all 18 at once.

---

## PART C — Internationalization (i18n): real architecture, real order

**Rollout order** (exactly as requested — India first, by realistic
NEET/JEE/UPSC test-taker population size, then international):

*Phase 1 — Indian languages:* Hindi → Bengali → Tamil → Telugu → Marathi
→ Gujarati → Kannada → Malayalam → Punjabi → Odia → Urdu.

*Phase 2 — International:* Spanish → Portuguese (Brazil) → French →
German → Italian → Russian → Chinese (Simplified) → Japanese → Korean →
Arabic.

**Technical decisions:**
- Every UI string gets extracted into locale dictionary files *now*,
  even before most languages are translated — this is the one-time cost
  that makes every future language "add a JSON file," not "hunt through
  every component again." This is the actual scalability move for i18n,
  more important than which language ships first.
- Arabic requires right-to-left layout — I will build the layout system
  RTL-capable from the start (even though Arabic ships last), so it's
  never a retrofit.
- Machine translation is the realistic first pass given no
  translation budget/team exists — but flagged honestly: for
  instruction-heavy tool UI, a wrong translated instruction can actually
  break someone's exam-day workflow, so machine-translated strings need a
  visible "help us improve this translation" path rather than being
  silently trusted as final. Not blocking Phase 1, but not pretending
  machine translation alone is "done" either.
- The footer's currently-fake HI/EN toggle becomes the real language
  switcher once Hindi lands — same UI slot, made honest.

---

## PART D — Scalability: answering "what happens when this gets big"

This is the right question to ask *before* it's a problem, not after.
Concrete answer, not a vague reassurance:

- **The current architecture is already shaped correctly for growth**:
  every tool is registry-driven (`lib/tools/registry.ts` +
  `/tools/[slug]`), so tool #30 should be built the same shape as tool
  #13 — a new registry entry + its own `lib/<tool>/` folder — not a
  special case requiring surgery on shared code. I will enforce this
  discipline on every new feature I build, specifically so nobody (me
  included, in some future session) is tempted to take a shortcut that
  creates the next "fabricated rollback doc"-style mess.
- **No backend exists today, and that's a genuine strength, not a gap** —
  every tool runs on the visitor's own device, so server cost doesn't
  scale with user count at all. I will resist adding backend complexity
  "because it sounds scalable" — a real backend is only justified once a
  feature genuinely needs one (e.g., real user accounts, cross-device
  sync, a sponsor dashboard) — and that will be its own explicit decision
  when/if it comes up, not snuck in as infrastructure nobody asked for.
- **Test coverage must grow with feature count, not lag behind it** —
  every new feature in Part B ships with its own regression tests, same
  discipline as this week's bug fixes (441 tests today; that number
  should keep climbing roughly in step with features, not flatline while
  features pile up untested).
- **Living documentation stays mandatory** — PROGRESS.md/PLAN.md/
  MASTER_PLAN.md are the actual insurance against "rewrite everything
  later because nobody remembers why it's built this way." This is
  exactly the problem a prior AI agent created with the fabricated
  rollback doc; the fix is discipline, not a rewrite.
- **Bundle size gets checked periodically**, not just once — matters
  more here than on a typical app because the audience is on patchy
  student data plans; a feature that's "fast once loaded" but slow *to*
  load is still a real cost to this specific audience.

---

## Execution order (starting now)

1. Design tokens (Part A's color/elevation system) — foundation
   everything else visually builds on. **Starting immediately below.**
2. Icon recolor.
3. Footer honesty fixes (dead links, fake toggle → removed until real,
   Legal-link hack → real link).
4. Hero copy/trust-signal pass.
5. Tier 1 features (Part B), one at a time, each tested.
6. i18n string-extraction groundwork (Part C), before the first real
   translation ships.
7. Tier 2/3 features, ongoing.

Each step: read the real code first, make the change, actually run/render
it, verify, commit, update PROGRESS.md — same discipline as every fix
this session, just applied to design and features instead of just bugs.
