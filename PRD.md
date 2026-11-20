# Tip Autopsy — Product Requirements Document

**Document status:** Approved V1 baseline + Phase 4 (V2) Real-Time & Finfluencer Alerts extension  
**Blueprint version:** 2.0  
**Product specification baseline:** *Tip Autopsy — Final Unified Specification Sheet*, v2.0 + Phase 4 Real-Time Extension  
**Product principle:** **We grade the information, not the investment.**

---

## 1. Executive Summary

Tip Autopsy is a mobile-first web application for first-time Indian retail investors who encounter stock tips on Telegram, WhatsApp, Instagram Reels, and YouTube. It examines one tip at a time and presents the evidence surrounding the tip: what the creator actually claimed, what important details were omitted, whether promotional language or sponsorship disclosure is present, what a dated SEBI register snapshot says, and what historical market data shows around the tip date.

The product is an evidence-literacy tool, not an investment decision engine. It must never tell a person to buy, sell, hold, avoid, or target a security. It must not assign an overall trust score to an influencer or a red/green verdict to a stock. Every result must be traceable to a source and an as-of date, and every dataset must be clearly identified as **Real**, **Synthetic**, or **Mixed**.

Version 1 is a hackathon-ready, end-to-end prototype with a production-minded architecture. When a user enters the site, they can submit **any photo (e.g., Telegram/WhatsApp screenshot), video (e.g., Hinglish finfluencer Reel/YouTube clip), or pasted Hinglish/English text**, along with the **influencer name** and **stock or instrument name**. A bounded multimodal extraction layer converts submitted photo, video, or text content into a structured Claim Ledger, while a deterministic evidence engine looks up the stock/instrument, checks a dated SEBI register snapshot, and computes market and lateness checks from preloaded snapshots. All facts-card sentences ("Information Verdict") are assembled from verified values and approved templates, then checked by an Output Guard.

The application has no end-user login and stores no personal user data in Version 1. Uploaded photos, videos, and pasted tip text are processed transiently and are never retained as an application record.

## 2. Product Context and Problem

Young, first-time investors frequently receive urgent, confident stock claims through social channels. Existing approaches often rank creators or display unadjusted hit rates, which can hide missing information, market-wide price movements, late entry points, promotion signals, and uncertainty.

Tip Autopsy changes the unit of analysis from *who should I trust?* to *what evidence surrounds this particular tip?* It makes the original claim inspectable, checks the context around the tip date, and introduces a deliberate pause before a user commits to acting.

### 2.1 One-line pitch

> Other tools rank who to trust. Tip Autopsy dissects this one Hinglish stock tip right now—checking SEBI registration, pre-tip manipulation signals, hype, and benchmark-adjusted track record—and demonstrates whether it helps retail investors avoid traps without ever telling them what to buy or sell.

### 2.2 Target user

**Primary user:** First-time Indian retail investors, approximately 18–25 years old, who encounter stock tips in Telegram groups, WhatsApp forwards, Instagram Reels, and YouTube videos and may not know how to assess the quality or completeness of the information.

**User needs:**
- Understand exactly what a tip claims, including what it does not say.
- Recognize urgency, certainty, and promotional language.
- Check a creator's name against a dated SEBI register snapshot without treating a missing match as proof of wrongdoing.
- See market context before and around the tip date.
- Understand uncertainty in historical creator outcomes rather than relying on a raw accuracy percentage.
- Pause and define personal risk limits before deciding what to do.

### 2.3 Jobs to be done

1. When I receive a stock tip, help me separate the creator's actual claims from hype and missing details.
2. When I see a creator name, show what the dated public register snapshot can and cannot verify.
3. When I inspect a tip, show the historical price, volume, and surveillance context around the date it was published.
4. When historical performance is shown, account for the Nifty 50 benchmark and uncertainty.
5. Before I act, prompt me to decide what I can afford to lose, where I would exit, and what evidence would prove the tip wrong.

## 3. Product Principles and Non-Negotiable Guardrails

1. **Evidence, not advice (Information Verdict only).** The product describes historical facts and risk factors around a tip. Any "verdict" shown by Tip Autopsy is strictly an **Information & Evidence Verdict** (grading completeness, disclosure, registration snapshot match, and market context)—never an investment action (`buy`, `sell`, `hold`, `avoid`, or `target`).
2. **No overall trust score.** Do not collapse the checks into a single creator rating, stock score, confidence meter, or red/green stock verdict.
3. **Unknown is a valid result.** Missing or stale data produces `Could not verify`, `Unclear`, or `Not stated`; it never produces an inferred fact.
4. **No dead-end on a missing SEBI match.** `Not found in SEBI register snapshot` is a neutral result. The rest of the autopsy continues.
5. **Bounded AI & multimodal extraction.** AI/OCR/STT may extract text and parse claims from uploaded photos, videos, or pasted text into a Claim Ledger only. Market checks, statistical calculations, source labels, and report sentences are deterministic.
6. **Provenance by default.** Show source, fetch timestamp or snapshot date, and Real (`Live Feed` vs. `Dated Snapshot`), Synthetic, or Mixed status wherever a user sees evidence derived from a dataset.
7. **Privacy by default.** No login, account, portfolio, personal profile, or persistent record of a user's uploaded photo/video, pasted tip, or Pause & Plan answers. In Phase 4, the sole permitted user-contact persistence is an explicit opt-in Finfluencer WhatsApp alert subscription (encrypted/masked destination, consent timestamp, and one-click unsubscribe).
8. **Neutral presentation.** Never use stock-level red/green treatment that could be interpreted as an action signal. Use color only for clearly defined evidence classifications such as disclosure transparency.
9. **No social-platform scraping.** Use permitted public historical/live market APIs, curated snapshots, and YouTube's official public Atom RSS / WebSub feeds; never scrape Telegram, WhatsApp, Instagram, or unauthorized social endpoints.

## 4. Goals, Success Metrics, and Non-Goals

### 4.1 Product goals

- Deliver a complete mobile-responsive tip autopsy from input to guarded facts card.
- Make the five deterministic market/lateness checks understandable to a first-time investor.
- Explain creator history with a benchmark-adjusted credible interval and an honest insufficient-evidence state.
- Add behavioral friction through the Pause & Plan gate.
- Demonstrate objectively whether the experience improves user decisions compared with a plain disclaimer and a raw leaderboard.

### 4.2 Success metrics

**Product and reliability metrics**
- A user can complete the five-step flow from either input mode without a mandatory third-party live API call.
- Every market or register result has a source and as-of date, or explicitly says it could not be verified.
- Every synthetic or mixed record is visibly labelled.
- Output Guard adversarial test suite produces zero system-authored buy/sell/hold/avoid/target recommendations.
- A missing influencer match does not prevent the rest of the analysis.
- The core experience works at narrow mobile widths and on desktop.

**Decision-quality experiment**
- Conduct a three-arm within-subject study with at least 40 participants and approximately 20 historical tips:
  - Arm A: plain tip plus a standard risk disclaimer.
  - Arm B: tip plus a raw accuracy claim, representing a leaderboard.
  - Arm C: Tip Autopsy facts card, Tip Time Machine, and Pause & Plan gate.
- Measure the rate of acting on tips that later collapsed, the rate of skipping tips that later succeeded, confidence calibration using Brier score, and decision time.
- Report negative or inconclusive results honestly. Do not use participant satisfaction alone as proof of impact.

### 4.3 Non-goals for Version 1

- Buy, sell, hold, avoid, or target-price recommendations.
- A single overall trust score, influencer ranking, or stock verdict.
- Trading, order placement, broker integration, portfolio management, or watchlists.
- End-user accounts, login, saved history, or personal profile data.
- Live scraping of Telegram, WhatsApp, Instagram, YouTube, or other social platforms.
- OS-level WhatsApp share-to-app integration.
- Labelling any individual as a scammer or fraud.
- Unlabelled synthetic datasets or synthetic values presented as real market evidence.
- Free-form AI-generated narrative in the final facts card.

## 5. MVP Scope and Feature Requirements

### 5.1 MVP features

| ID | Feature | Requirement | Acceptance outcome |
|---|---|---|---|
| FR-01 | Multimodal & structured input | Accept any **photo** (screenshot), **video** (clip/Reel), or **pasted Hinglish/English tip text**, paired with user-entered (or confirmed) **influencer name** and **stock/instrument name**. Also provide one-click curated demo clips/photos from `photos/` and `videos/`. | Photo, video, text, and direct influencer + stock inputs all reach the same evidence workspace; deterministic lookup works even if media/text parsing is unavailable. |
| FR-02 | Claim Ledger | Extract text/transcript (when photo or video is supplied) and parse stock/instrument, direction, target price, deadline, and stop-loss. Show `Not stated` for missing fields (and explicitly note paywalled stop-losses such as `SL PAID` / `SL. VIP PREMIUM` as not stated/gated) with source-span highlights. | No missing value is silently inferred; source highlighting is available for extracted fields. |
| FR-03 | Hype Detector | Highlight urgency and pressure phrases such as “guaranteed”, “last chance”, “double money”, and “join my Telegram”. | The highlighted phrase is visible in the original source text and is not treated as proof of manipulation. |
| FR-04 | Disclosure Grade | Classify sponsorship transparency as `Clear disclosure`, `Vague`, or `None`; benchmark against a plain `#ad` keyword baseline. | The grade includes the evidence and method; it is not represented as a legal compliance certification. |
| FR-05 | SEBI snapshot lookup | Check the entered/extracted creator name (and known channel aliases in curated records) against a dated public SEBI register snapshot. Return `Registered`, `Not found`, or `Unclear`. | `Not found` is neutral wording and never stops the autopsy. Name mismatches remain `Unclear` when identity cannot be established. |
| FR-06 | Five deterministic checks | Calculate liquidity, market-cap band, volume spike, five-trading-day pre-tip run-up, and surveillance/circuit-band context for supported equities. For index option contracts (e.g., `Sensex 82900 CE`, `Nifty 25500 CE`) or missing data, return `Could not verify` for inapplicable/missing checks. | Each check returns a neutral status, measured value, as-of date, explanation, and source; missing or derivative-inapplicable data returns `Could not verify`. |
| FR-07 | Creator track record | Evaluate resolved historical tips against a Nifty 50 benchmark-adjusted outcome and use a Beta-Binomial credible interval. | Display a range and sample context; show `Not enough tips to judge` when evidence is insufficient or does not clear the baseline. |
| FR-08 | Tip Time Machine | Show interactive stock price and volume history with markers for relevant tip dates. | Tapping a marker shows only tips for that influencer-stock pair on that date, including source link and Real/Synthetic label. |
| FR-09 | Information Verdict (Guarded Facts Card) | Assemble the stock evidence summary and system's **Information Verdict** from fixed templates and verified values; run the Output Guard before returning it. | Unsafe generated narrative is blocked and replaced by a safe fallback. Mandatory disclaimer is always present; no buy/sell/hold advice is emitted. |
| FR-10 | Pause & Plan | Before a user selects `I'd act on this`, ask the three pre-commitment questions. | The action path is gated until all three responses are completed; the app does not convert responses into advice. |
| FR-11 | Evidence transparency | Show Real/Synthetic/Mixed labels and snapshot dates on every evidence view. | No synthetic data is visually indistinguishable from real data. |
| FR-12 | Privacy | Process uploaded photos, videos, and pasted text transiently; do not create end-user accounts or persist user-submitted media or tips. | No user-uploaded photo/video, raw pasted text, or personal user data is written to disk persistence, the application database, or ordinary logs. |
| FR-13 | Voice readout (optional) | Provide short Hindi, Kannada, or English voice summaries through Sarvam when configured. | Voice failure never blocks the text experience; voice reads only the already-guarded facts card. |
| FR-14 | Zero-cost real-time market data | Fetch live/near-real-time Indian NSE/BSE equity quotes, `NIFTY 50` / `SENSEX` / `BANKNIFTY` benchmarks, universal NSE/BSE ticker search, and fresh daily OHLCV history via free Yahoo Finance v8 endpoints with server-side TTL caching and automatic Supabase snapshot fallback. | Every live metric shows `Real · Live Feed · fetched HH:MM IST` (with honest exchange delay note); upstream failure falls back cleanly to dated snapshots or `Could not verify`. |
| FR-15 | Real-Time Stocks page (`/stocks`) | Dedicated workspace page displaying live benchmark cards, universal NSE/BSE ticker search, curated Indian equities watchlist, live price/volume/market-cap/52W range, interactive intraday/3M Recharts chart, and one-click handoff to `/analyze`. | Neutral presentation with zero BUY/SELL badges or red/green action coloring; every figure displays tabular numerals and explicit freshness provenance. |
| FR-16 | Finfluencers directory & real-time YouTube monitoring (`/finfluencers`) | Track Indian finfluencers with SEBI register snapshot status, linked YouTube channel, and real-time new video detection via official zero-cost YouTube Atom RSS feeds (plus optional WebSub push). Extract captions (or fallback to title + description), parse Claim Ledger with bounded free-tier AI (Gemini / Groq + deterministic fallback), run deterministic SEBI + live market checks, and display Output-Guarded video Facts Cards. | Every analyzed YouTube video shows `Real · YouTube Official RSS`, transcript vs. metadata-only provenance, Claim Ledger, Hype/Disclosure audit, and guarded Information Verdict without social scraping. |
| FR-17 | Opt-in automated WhatsApp alerts | Allow users to subscribe to any tracked finfluencer on `/finfluencers` with explicit opt-in consent and receive an automated WhatsApp message whenever a new YouTube video is analyzed, using zero-cost adapters (`callmebot`, official `meta_cloud` free sandbox, or `dry_run` preview + `wa.me`). | Every WhatsApp alert passes strictly through allowlisted templates + Output Guard + verbatim mandatory disclaimer; contact credentials are encrypted/masked with one-click unsubscribe. |

### 5.2 Required market checks

Every check must return one of the following neutral states:
- `Within normal range`
- `Needs attention`
- `Could not verify`

| Check | Evidence and calculation | User-facing explanation |
|---|---|---|
| Liquidity | Average daily traded value (`close × volume`) over the configured prior N trading sessions. | Thinly traded stocks can be harder to trade and may be more sensitive to concentrated activity. |
| Market cap | Market-cap snapshot mapped to a versioned size band: Large, Mid, Small, or Micro. | Smaller companies can experience larger price swings and may be easier to move. |
| Volume spike | Tip-day volume compared with the average volume over prior N sessions; use a ratio and/or calibrated z-score. | A sharp increase in trading around a tip can be a signal worth examining. |
| Lateness / pre-tip run-up | Percentage price move over the five trading sessions before the tip. | Shows whether a large price move occurred before the tip reached followers. |
| Surveillance / circuit band | Dated NSE/BSE ASM/GSM watchlist status and current circuit-band snapshot. | Shows whether an exchange surveillance or circuit-band designation applied as of the displayed date. |

Thresholds must be calibrated against historical SEBI enforcement cases and a normal-stock comparison set. They must be stored as versioned configuration, not guessed or embedded as unexplained constants. The lookback window N is configurable; the initial engineering default may be 20 trading sessions, subject to validation before release.

### 5.3 Creator track record requirements

- Resolve historical tips at their stated deadline using dated stock and Nifty 50 data.
- Compare outcomes with the Nifty 50 benchmark rather than displaying raw hit rate alone.
- Apply a Beta-Binomial model and display a credible interval, sample size, resolved/unresolved counts, and the benchmark definition.
- Do not make claims from an insufficient sample. Display `Not enough tips to judge` when the minimum sample policy is not met or when the credible interval does not clear the matched market baseline.
- Keep the prior, interval level, baseline cohort, and calculation version explicit and reproducible.

## 6. End-to-End User Flow

### Step 1 — Input (Photo, Video, or Text + Influencer & Stock)

When entering the website, the user:
- Inputs **any photo** (e.g., Telegram/WhatsApp tip screenshot), **video** (e.g., Hinglish finfluencer Reel/YouTube clip), or **pasted tip text** in Hinglish or English (or selects a preloaded sample from the curated `photos/` and `videos/` showcase); and
- Enters (or confirms/edits) the **influencer name** and **stock / instrument name**.

The deterministic influencer + stock lookup route must remain fully usable even if media extraction or LLM parsing is unavailable, slow, or returns invalid structured output.

### Step 2 — Claim Ledger and Language Audit

The application displays:
- Extracted OCR text or video transcript (when a photo or video is supplied), kept visibly separate from system commentary.
- Stock/instrument, direction, target price, deadline, and stop-loss.
- `Not stated` for every missing field (and explicit flagging when a stop-loss is gated behind a paid group such as `SL PAID` or `SL. VIP PREMIUM`).
- Source-span highlights for extracted claims.
- Highlighted urgency and pressure phrases.
- Disclosure Grade with supporting phrase(s) and a clear explanation of the method.

The app must distinguish an exact quote from a system-authored explanation. The quote may contain advice language because it is the creator's original text; it must remain visibly quoted and must never be rewritten as the application's recommendation.

### Step 3 — Stock Context, Identity, and Market Evidence

The application resolves the entered **stock/instrument** and displays the **SEBI snapshot match status** for the entered **influencer name** without halting on `Not found` or `Unclear`, then computes the five deterministic checks for the relevant tip date and current available snapshot date. Each result includes the measured figure, status, source, as-of date, and plain-language meaning (returning `Could not verify` for uncovered derivative contracts or missing snapshots).

The creator track record appears as a benchmark-adjusted credible interval, or `Not enough tips to judge`.

### Step 4 — Tip Time Machine and Information Verdict (Guarded Facts Card)

The interactive chart displays historical close and volume for the matched stock (or underlying index where applicable), with tip-date markers and relevant pre-tip movement. Selecting a marker opens all matching tips for that exact creator-stock-date combination, with original text, source link, and Real/Synthetic badge.

The **Information Verdict (Guarded Facts Card)** summarizes only verified evidence about the tip and stock context—never an investment action recommendation. All system-authored sentences are assembled from approved templates, validated values, and provenance references, then passed through the Output Guard. A short Hindi, Kannada, or English voice readout may be offered when enabled.

### Step 5 — Pause & Plan

Before the user selects `I'd act on this`, ask:
1. How much can I afford to lose?
2. At what price do I exit?
3. What would prove this tip wrong?

The app records answers only in the active client session and does not persist them. The questions are a behavioral pause, not a calculation of a recommended position size or exit price.

## 7. User Stories and Acceptance Criteria

### First-time investor

- As a user, I can paste a Hinglish tip and see which fields were stated and which were omitted.
- As a user, I can inspect the exact phrase that caused a hype or disclosure flag.
- As a user, I can see `Not found in SEBI register snapshot dated …` without being told the creator is fraudulent.
- As a user, I can see price and volume context around the tip date without receiving a stock-level buy/avoid signal.
- As a user, I can distinguish real market records from synthetic demo tips.
- As a user, I can stop before an action and answer the three Pause & Plan prompts.

### Product acceptance tests

- Pasted input and structured lookup both lead to a facts card when the necessary evidence is available.
- A missing stop-loss renders `Not stated`; the parser does not infer one.
- An absent SEBI match does not prevent market checks or report generation.
- Any missing market input produces `Could not verify`, not a guessed status or value.
- Selecting one chart marker returns only tips for that selected date and creator-stock pair.
- Every report includes the mandatory disclaimer verbatim:

  > This report describes historical facts and risk factors around a tip. It is not investment advice or SEBI-registered research. The decision is yours.

- Output Guard tests block system-authored advice language, including adversarial paraphrases and variants of `buy`, `sell`, `hold`, `avoid`, `target`, `undervalued`, `overvalued`, `will rise`, and `will fall`.
- No user account, portfolio, profile, saved tip history, or persistent pasted text is created.

## 8. UX and Visual Design Direction

The source specification requires a mobile-first responsive interface and neutral stock framing. The following visual tokens are the recommended implementation direction for review; they are design decisions, not facts supplied by the source specification.

### 8.1 Visual language

> **Single Source of Truth:** Exact colors, Liquid Glass tokens, typography, iconography (`@phosphor-icons/react`, never Lucide or emoji icons), and component geometry are governed by `DESIGN.md` v2.0.

- **Overall feel:** Calm, editorial, evidence-led, and approachable. Avoid trading-terminal density, casino-like motion, price-prediction styling, or gamified trust scores.
- **Background:** Warm ivory canvas (`#FAF8F4` / `#F3EFE7` shader fallback via verbatim `ui-ux/DashBoardBackground.jsx`) with translucent Liquid Glass and white (`#FFFFFF`) evidence cards.
- **Primary text:** Rich charcoal (`#161A18`) for strong contrast and visual hierarchy.
- **Brand accent:** Muted sage-forest (`#4A7C64` / `#1F4D3A`) for navigation, links, chart focus, and primary neutral indicators.
- **Borders and secondary text:** Hairline charcoal (`rgba(22, 26, 24, 0.09)`) and muted sage-charcoal (`#4A524D`, `#6E7771`).
- **Needs attention:** Warm amber/ochre (`#9A5B13` on `#FDF3E4`) with an explicit text label and icon.
- **Could not verify / Unverified:** Neutral slate (`#4E5964` on `#EEF1F4`); never hide uncertainty behind an empty state.
- **Disclosure Grade:** `Clear disclosure` uses calm sage-green (`#2A6F52` on `#E6F2EC`), `Vague` uses amber, and `None` uses neutral slate. These colors describe disclosure evidence only, not investment merit.
- Do not use red/green treatments to classify a stock or tell a user what action to take.

### 8.2 Layout behavior

- Design from a 360 px mobile viewport upward; support narrow devices without horizontal page scrolling.
- Use the visual reference direction in `ui-ux/` (`ui-ux/hero.jpeg` for the hero section, `ui-ux/DashBoard.png` for the frosted-glass sidebar + overview/workspace dashboard shell, and `ui-ux/DashBoardBackground.jsx` for the animated dashboard gradient background), adapting any mock-only labels (`Past Reports`, `Confidence Score`, `Live Market Data`) to Tip Autopsy's strict zero-persistence, non-advisory, dated-snapshot guardrails.
- Use a single-column flow on mobile and a readable sidebar + multi-column evidence layout on wide screens where appropriate.
- Include a Dashboard Overview band with dated `NIFTY 50`, `SENSEX`, and `BANKNIFTY` benchmark snapshot cards and a Curated Demo & In-Session Analyses table (zero saved history across sessions).
- Keep the primary task visible: input first, evidence second, chart and facts card third, Pause & Plan last.
- Use clear numbered progress steps and persistent back navigation so a user can inspect earlier evidence without losing their in-session analysis.
- Place snapshot date and Real/Synthetic label directly beside the evidence they qualify, not only in a footer or settings page.
- Use collapsible detail sections for methodology, source notes, and calculation context; keep the plain-language explanation visible by default.
- Use a tappable chart with large enough markers and a selected-date detail sheet on mobile. Provide an accessible list alternative to chart markers.
- Keep the Pause & Plan questions focused and separate from the evidence card. Do not present a pre-filled amount, price, or action suggestion.
- Show loading, empty, stale-data, partial-data, parser-unavailable, and error states explicitly.

### 8.3 Typography and interaction

- Use a highly legible sans-serif system font stack, strong heading hierarchy, and readable line length.
- Keep financial values tabular where possible; always include units and dates.
- Use plain language and define terms such as traded value, volume spike, credible interval, and benchmark-adjusted outcome in contextual help.
- Do not rely on color alone; combine status text, icon, and accessible labels.
- Respect reduced-motion preferences and provide keyboard-operable controls.

## 9. Data Transparency and Content Rules

| Dataset | Intended source | Required label |
|---|---|---|
| Prices, volume, market cap, circuit bands, ASM/GSM | NSE/BSE public historical snapshots + Phase 4 free Yahoo Finance v8 NSE/BSE live feed (with snapshot fallback) | `Real · Live Feed (fetched HH:MM IST)` or `Real · Dated Snapshot (as-of date)` |
| Registered intermediaries | SEBI public register | `Real` plus snapshot date |
| Finfluencer new YouTube uploads | Official YouTube public Atom RSS / WebSub feed + public caption tracks (zero scraping) | `Real · YouTube Official RSS` plus publish timestamp and `Transcript` / `Metadata only` label |
| Manipulation calibration cases | Public SEBI enforcement orders | `Real`; disclose that the calibration sample is limited and report uncertainty |
| Hinglish tip ledger, curated `photos/` & `videos/` corpus, and coordinated-promotion examples | Hand-collected public posts/screenshots/clips and team-authored examples | `Mixed` or `Synthetic` on every relevant record |

### 9.1 Curated Hinglish Influencer Media Corpus (`photos/` & `videos/`)

The repository includes curated Hinglish influencer tip media organized under `photos/` and `videos/` using the `<Influencer_Name>__<Stock_Name>__<Registration>` filename convention:

- `photos/Ashish_Kyal__Sensex_82900_CE__Not_Registered.jpeg`
- `photos/Chinmay_Dudhane__Nifty_25500_CE__Registered.jpeg`
- `photos/Harsh_Bhagat__Nifty_25600_CE__Not_Registered.jpeg`
- `videos/Rakesh_Bansal__Borosil_Renewables_Ltd__Registered.App.mp4`
- `videos/Rakesh_Bansal__Sarveshwar_Foods__Registered.App.mp4`
- `videos/Vivek_Rana__Wipro_Limited__Not_Registered.App.mp4`

These curated assets seed the demo showcase and one-click sample inspection flow. Filename registration tags represent curated corpus metadata and must be reconciled with dated `sebi_register_entry` snapshots rather than trusted as live verification for arbitrary user-uploaded files.

No synthetic value may be substituted for a missing real value without an explicit Synthetic label. A demo dataset must not be described as live market data. Source usage rights and retention limits must be checked before importing public posts or datasets.

## 10. Risks and Known Limitations

- **False positives on illiquid stocks:** Legitimate discussion of a thinly traded stock may trigger a liquidity warning.
- **Large-cap blind spot:** Coordinated promotion of liquid large-cap stocks may not create an unusual volume signature.
- **Hinglish and multimodal edge cases:** Sarcasm, slang, transliteration, emoji-coded tickers, low-resolution phone photos, and noisy video audio can reduce extraction quality.
- **Derivatives vs. equity check scope:** Index option tips (e.g., `Sensex 82900 CE`, `Nifty 25500 CE`) do not map cleanly to equity market-cap or ASM/GSM watchlists and must yield `Could not verify` for inapplicable checks.
- **Hidden sponsorships and gated stop-losses:** Paid promotions with no textual disclosure cues may be missed, and tips gating stop-losses behind paid tiers (`SL PAID`, `SL. VIP PREMIUM`) must be flagged as missing actionable risk limits.
- **SEBI name mismatch:** A social handle or Telegram channel name (e.g., `Trading cafe India`) may differ from a legal name in the register; a missing or ambiguous match is not proof of non-registration.
- **Small historical sample:** Credible intervals may remain wide or insufficient to judge.
- **Data availability:** Public datasets may be incomplete, delayed, revised, or subject to access restrictions.
- **Behavioral-study limits:** Students using hypothetical money are not identical to active investors, and friction effects may fade over time.

These limitations must be visible in methodology/help content and in the final evaluation report.

## 11. Roadmap After the MVP

1. OS-level WhatsApp share-to-app integration, after privacy, consent, and platform-policy review.
2. Broader language coverage and more robust Hinglish multimodal (OCR/ASR) parsing after evaluation on a hand-labelled corpus.
3. Additional exchange and data-provider integrations with explicit source provenance.
4. More sophisticated coordinated-promotion signals, only when evidence and calibration support them.
5. Voice readout in Hindi, Kannada, and English if not completed in the hackathon MVP.
6. A larger, longitudinal behavioral study to test whether decision-quality improvements persist.

## 11A. Pretend Money — 10-Year Historical Allocation Sandbox (`/pretend-money`)

- **Educational Purpose:** Give first-time Indian retail investors a safe, zero-cost historical sandbox where they can make realistic capital-allocation, entry-timing, and stop-loss choices using virtual pretend money (`₹25,000` to `₹10,00,000` default adjustable wallet) across a **10-Year Historical Timeline** of any NSE or BSE stock.
- **10-Year Historical Timeline & Milestones:** Displays 10 years of weekly historical close & volume data (`~520` weekly bars from Yahoo Finance v8 with automatic snapshot-anchored 10-year calibration fallback) alongside 10-year historical landmarks (`10Y Start`, `10Y Historical Low`, `Sharp Run-Up Peak`, `Deepest Pullback Trough`, `10Y Historical High`).
- **Interactive Choices with Fake Money:**
  - Click any date on the 10-year curve (or scrub the entry-date slider) to deploy a tranche of pretend money at that exact historical close price.
  - One-click educational choice scenarios: *100% Lump Sum 10 Years Ago*, *Chased a Sharp Pre-Tip Run-Up Peak*, *Yearly Staggered Tranches (10 × 10%)*, and *3-Part Pullback & Recovery Split*.
  - Optional **Stop-Loss Rule Choice** (`No Stop-Loss / Unprotected` vs. `10%`, `15%`, `20%`, or `30%` threshold) to observe how downside limits behave during historical drawdowns.
  - **Time-Travel Evaluation Cursor**: Scrub the evaluation date across the 10-year window (or step `+6 Months` / `+1 Year`) to watch how each choice evolves over time.
- **Non-Advisory Guardrails & Zero Persistence:**
  - Compares every pretend allocation against placing the exact same cash flows on the exact same historical dates into the **NIFTY 50** index and a `6.5% p.a.` fixed reference rate.
  - All educational takeaways are scanned by the mandatory Output Guard (`scanSystemAuthoredText`) and carry the verbatim mandatory report disclaimer.
  - Pretend wallet balances and timeline choices live strictly in transient browser memory (zero login, zero `localStorage`, zero database persistence).

## 12. Release Definition

Version 1 is ready for a public demo only when:
- All core flows work using preloaded dated snapshots, without dependence on fragile live endpoints.
- No user login or personal-data storage is present.
- Real/Synthetic labels and as-of dates are visible at every relevant point.
- All five market checks have calibrated, documented thresholds and a `Could not verify` path.
- Creator results use benchmark-adjusted outcomes and credible intervals with an honest insufficient-evidence state.
- The Output Guard passes the adversarial suite with zero system-authored advice outputs.
- The mandatory disclaimer is present on every facts card.
- Mobile responsiveness, accessibility basics, API failure states, and a full end-to-end demo are verified.
- Known limitations and experimental results are reported honestly.
