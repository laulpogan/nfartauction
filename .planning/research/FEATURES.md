# Feature Landscape

**Domain:** Multiplayer browser board game + daily life sim + economic auction engine
**Project:** NFArt (Modern Art by Knizia, 1992 + gallery sim)
**Researched:** 2026-04-06

---

## Table Stakes

Features users expect from this genre combination. Missing any of these and the product feels broken or unfinished.

### Auction Engine

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| All 5 auction types functional | Modern Art's identity — remove one and it isn't the game | Low (exists) | Bugs exist in double and sealed; must be fixed before sim wraps it |
| Sealed bids are actually sealed | Any digital auction game: bids must be hidden from opponents until reveal | Low (security fix) | Currently broken — all clients receive `sealedBids` record verbatim |
| Turn indicator: whose bid/play is it | Players need to know who is acting without ambiguity | Low | "Waiting for X" states must be visible to all non-acting players |
| Auction resolution feedback | Players need to see who won, what was paid, what they get | Low | Receipt-style rendering fits the project aesthetic |
| Auctioneer clarity | Who put the card up must be obvious throughout bidding | Low | Double auction especially: auctioneer vs non-auctioneer roles must be visually distinct |
| Card count visible (not hand contents) | Players need to track how many cards others hold — not what they are | Low | Private hands are already implemented; show count badge only |
| Round-end scoring reveal | After each round: artist values, who earned what | Medium | This is the emotional payoff of each round |
| Game-over final appraisal | Total scores, winner declared, end state | Medium | Leaderboard-as-auction-receipt format is defined in PROJECT.md |
| Reconnect without losing game | Browser games drop connections; must recover gracefully | Medium | Durable Object handles state; `roundEndResult` in React state is the gap |

### Multiplayer Infrastructure

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Room code join | Standard for browser multiplayer; no login required | Low (exists) | 4-character code pattern already implemented |
| Waiting room / lobby | Players need to coordinate before starting | Low (exists) | Already implemented |
| Real-time turn notifications | Players not watching must know it is their turn | Low | In-browser: tab title update + visual pulse on active player element |
| Disconnect indication | Show when a player loses connection | Low | Distinguish "thinking" from "dropped" — timer threshold works |
| 2–4 player support | Board game's defined player count | Low (exists) | Engine already supports it |

### Life Sim

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Stat display: Money, Coolness, Restedness, Luck | If stats affect outcomes they must be readable | Low | Wall-label format per PROJECT.md |
| Time slot schedule per day | Core sim loop; players must choose how to spend limited time | Medium | Morning / afternoon / evening / night — cannot fill all slots |
| Slot cost feedback | Players must understand what each slot costs (time, money, stat) | Low | Inline on slot selection, not buried in a rules modal |
| Neighborhood map | Five neighborhoods exist; travel between them must make spatial sense | Medium | Map as zine spread, not a 3D world |
| Shared economy | Sim money and auction money must visibly be the same number | Low | Core design principle — if these look separate, the design has failed |
| End state summary | Post-game appraisal document + leaderboard | Medium | Defined in PROJECT.md; must render cleanly |

---

## Differentiators

Features that make this game. Not universally expected, but what players will describe when recommending it.

### Aesthetic System as Gameplay

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zine visual language (white, black type, single accent per neighborhood) | The restraint is the personality; feels like art-world ephemera, not a game UI | Medium | Built into component architecture, not applied as a skin later |
| Auction results as printed receipts | Gives auction resolution a physical artifact quality; memorable and shareable | Low | Tailwind print-style components; distinct from game board layout |
| Stats displayed as appraisal forms | Wall-label copy treating drug inventory the same as painting collection is the bit | Low | Same template, different fields — cognitive dissonance is intentional |
| 5 auction type visual skins | Preview night, formal dinner, phones reveal, price tag, drop countdown — each auction type has a mood | Medium | Differentiates auction types beyond mechanic differences; table stakes for the aesthetic brief |
| NFT layer as unlock (Coolness threshold) | Parallel economy that looks slightly wrong — fonts flicker, exchange rate is volatile | High | Must feel like a bug in the world, not a separate game mode |

### Gallery Sim Mechanics

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Global stats: Art Market Hotness, Gentrification Level, NFT Hype Cycle | Shared environmental variables that nobody fully controls; creates emergent group storytelling | Medium | Fluctuate per round; visible to all players |
| Faction alignment by who you represent | Gallery develops an identity from auction choices, not a menu selection | High | Thin in v1: stat modifiers only; narrative expansion is v2 |
| Landlord text message arc (5 stages) | Prestige-gated negotiation; absurdist relationship with institutional power | Medium | Text message format in wall-label typography — same visual system |
| Drug system: inventory + passive Risk stat | Usable at parties/fairs; tracked alongside painting inventory (same appraisal form) | Medium | Named stubs in v1; full NPC dealer network is out of scope |
| Named artist/collector relationships with decay | Neglect has consequences; bid likelihood degrades over time | High | Relationship decay (Sims model: daily timer -N points) is the mechanic; keep visible to player |
| NFT parallel economy with volatile exchange rate | Satirical layer: same world, same UI, the numbers just behave worse | High | Exchange rate as a global stat; can crash between rounds |

### Multiplayer Board Game UX

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Spectator mode | Let late arrivals or dropped players observe without disrupting game | Medium | Board Game Arena model: full view, no interaction, chat access |
| Auction timer (visible countdown) | Prevents analysis paralysis; creates auction-room pressure | Low | Optional per auction type — once-around and fixed price benefit most; open cry less so |
| Private information indicators | Show clearly what opponents cannot see (your hand, your sealed bid) | Low | Shaded or inverted card backs for held cards; "SEALED" label during sealed bid phase |
| History log (auction by auction) | Players can review what sold for what; essential for strategy in later rounds | Medium | Condensed receipt stack; expandable |

### Procedural Text

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| End-state appraisal text generation | Personalized summary of how each player's strategy reads in art-world language | Medium | Template-based with conditional branching on stats/choices; LLM optional enhancement in v2 |
| Landlord message arc text | 5-stage escalation: each stage has a distinct register (polite, passive-aggressive, threatening, bargaining, resolved) | Low | Fixed authored text with variable player name/stat insertion — not procedural, just well-written |
| Art criticism flavor for round results | Brief mock-critical line per artist whose value changed this round | Low | Short authored pool (10–20 templates per artist, 5 artists) with stat-keyed selection |

---

## Anti-Features

Features to explicitly NOT build in v1. Including any of these adds scope without adding the game's value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Deep relationship event trees (dating sim depth) | Correct scope call from PROJECT.md — the auction IS the game; NPC trees are a different product | Named stubs with decay timer; relationship visible as a number, not a storyline |
| Full drug acquisition NPC network | Same — named dealer characters are v2 content expansion | Drug items in inventory with tracked quantity; acquisition is abstracted (time slot cost) |
| Sound system (cocktail party ambience, HVAC, airport noise) | Every audio decision is an open-ended rabbit hole; zine aesthetic works without sound | Silence is consistent with the visual restraint; add in v2 |
| Instagram feed rendering | Social layer adds auth, image hosting, sharing infrastructure | End-state appraisal document is the shareable artifact — one screenshot, not a feed |
| Canvas/WebGL rendering | Contradicts the browser-2D design principle; also adds 3D asset pipeline | Tailwind layout IS the art direction; CSS transitions for auction reveals |
| Server-side rendering | Adds infrastructure complexity for no gain in a session-based multiplayer game | Static frontend + PartyKit is the correct split |
| Play-to-earn / real token integration | NFT game economy collapses when tokens have real value: Axie Infinity SLP -99%, 93% of blockchain gaming projects fail in year one | NFT layer is satirical and in-game-currency only; the joke requires it to be fake money |
| Wallets / crypto onboarding | Onboarding friction kills browser game sessions; crypto wallet UX is a different genre | Room code join with no auth is the correct model; NFT unlock is Coolness-gated, not wallet-gated |
| Asynchronous/turn-based play | Modern Art is a live negotiation game; async removes the social pressure that makes auction types meaningful | Real-time only; if a player drops, reconnect or forfeit |
| AI opponents | Adds an entire discipline (game tree search or ML) that is not the game's value; Modern Art AI is an unsolved hard problem | 2–4 human players only; bot placeholder for testing only |
| Achievement/badge system | Adds persistent identity infrastructure and balance work | End-state appraisal document IS the achievement; one-session game does not need a trophy room |
| Undo mechanic | In a real auction, you cannot unplace a bid; undo breaks the game's tension | Confirm dialog on irreversible actions (sealed bid submit, fixed price accept) is sufficient |
| Per-player statistics across sessions | Requires user accounts, a database, and privacy decisions | Session-scoped only; leaderboard lives only for the duration of the session |
| Tutorial / guided onboarding flow | Scope risk: tutorials go out of date and are expensive to maintain | Rulebook link in lobby, clear in-game labels, first-time tooltip on each auction type |
| Monetization / premium content gating | Destroys the game's art-world satire if the art is literally locked behind a paywall | Free, no paywall; NFT unlock is Coolness-gated via gameplay, not purchaseable |

---

## Feature Dependencies

```
Sealed bid fix → Any sealed bid auction is playable
Double auction enforcement → Double auction is trustworthy
Engine test coverage → All downstream sim features can be built confidently

Time slot scheduling → Neighborhood travel (travel consumes a slot)
Time slot scheduling → Drug system (party/fair slots are the use context)
Time slot scheduling → Relationship decay (decay happens per day, days are measured in slot cycles)

Faction system stubs → Global stat modifiers → Bidding behavior modifiers
Relationship system stubs → Bid likelihood → Auction outcomes

Coolness stat threshold → NFT layer unlock → Parallel economy display
NFT economy → Volatile exchange rate global stat → Round-to-round fluctuation

Art Market Hotness (global) → Artist value multipliers → Round scoring
Gentrification Level (global) → Neighborhood travel cost modifiers

Auction results receipt → History log stack → Strategy context for later rounds
Round-end scoring reveal → End-state appraisal document (aggregates all four rounds)
```

---

## MVP Recommendation

Build in this order based on dependencies and game integrity:

**Must have for any playable session:**
1. Sealed bid security fix (currently mechanic-breaking)
2. Deck exclusion from public broadcast (currently strategic-cheating vector)
3. Double auction second-card enforcement (currently broken rule)
4. Turn indicator — clear "waiting for X" states
5. Auction resolution receipt display
6. Reconnect recovery for `roundEndResult`

**Must have for the sim to mean anything:**
7. Stat display: Money, Coolness, Restedness, Luck
8. Time slot scheduling with slot-type UI
9. Shared economy (sim money = auction money, visually unified)
10. Zine aesthetic system baked into all components (built first, not retrofitted)

**Differentiators that define the game's identity:**
11. Auction type visual skins (5 types, 5 moods)
12. Global stats: Art Market Hotness, Gentrification Level, NFT Hype Cycle
13. Landlord text message arc
14. Relationship stubs with decay timer
15. Drug inventory tracked alongside paintings (same appraisal form)
16. End-state appraisal document with templated criticism text
17. Spectator mode

**Defer to v2:**
- Faction narrative depth (v1: stat modifier stubs only)
- Procedural art criticism via LLM
- Sound system
- Deep NPC relationship trees
- Full drug acquisition network
- Instagram feed
- AI opponents

---

## Lessons from Adjacent Domains

### Digital Modern Art Implementations
No widely-reviewed current digital implementation exists (as of 2026). The 2005 PC version is the primary reference; Board Game Arena does not host Modern Art (it is not in their catalog). This means: there is no established UX pattern to follow or fight — the aesthetic system is building on a blank slate. Risk: also no reference implementation to validate auction type feel against.

### Life Sim Time Pressure (Stardew Valley, Recettear)
The tension between time scarcity and activity desire is the life sim's core affect. Key pattern: players should always feel they could do one more thing, but cannot. The slot system (cannot fill all four slots) must be designed so each choice feels real, not like arbitrary resource drain. Stardew's energy system creates natural stopping points; NFArt's Restedness stat serves the same function — zero Restedness must have visible consequences (reduced Luck, stat penalties next session).

### Relationship Decay (The Sims)
The Sims 2 model is directly applicable: daily decay at a fixed time (-2 points per relationship per day). Key design lesson: decay must be visible to the player before it becomes a problem — a "fading" state before "cold" state. For NFArt: show relationship health indicator on artist/collector cards in the gallery view; let players see who they have neglected.

### NFT/Crypto Game Economy Anti-Patterns
The failure mode is consistent: when tokens have real exchange value, the economy becomes the product and the game becomes incidental. Axie Infinity's SLP token crashed 99%. 93% of blockchain gaming projects fail within year one (source: NFT News Today, 2025). The NFArt NFT layer is structurally correct because it is satirical in-game currency only. The volatile exchange rate and flickering UI are commentary, not an investment vehicle. Never make the NFT layer extractable to a real wallet — that crosses from satire to liability.

### Digital Auction UX
Sealed-bid auctions require a commit-then-reveal protocol to be trustworthy. The current codebase broadcasts raw bid amounts before reveal — a fundamental breach. The pattern: store actual bids server-side only; broadcast only presence indicators (bid submitted: yes/no) until all bids are in; reveal simultaneously. Board Game Arena implements this correctly for sealed-bid games.

The four primary auction types from auction theory (open outcry / English, Dutch, first-price sealed, second-price sealed / Vickrey) all have distinct psychological characters. Once-around (Modern Art variant) creates a distinct social dynamic: you know exactly when your one chance comes. The UI must make "you have ONE bid" viscerally clear — visual countdown of position in the rotation, not just a text label.

### Multiplayer Board Game UX (Board Game Arena model)
Table stakes from BGA analysis:
- Rule enforcement by the server (not client honor system) — NFArt must validate server-side
- Spectator mode: full view, no action, chat access
- Turn notification: tab title + visual highlight on active player element
- Game log: every action recorded and reviewable
- Reconnect: state restored from server on rejoin (partial in current codebase; `roundEndResult` gap)

### Procedural Text Generation
Template-based generation with conditional stat/choice keys is the right approach for v1 — reliable, authored voice, no inference latency. The art criticism flavor text (10–20 templates per artist, stat-keyed selection) can produce high variation with low complexity. LLM integration is a v2 upgrade path, not a v1 dependency. Key risk with LLM: voice consistency — the zine register is specific and LLMs default to generic. Template pool with a strong editorial voice outperforms a generic LLM prompt for a game with this specific aesthetic.

---

## Sources

- BoardGameGeek: Modern Art (BGG #118), auction mechanic pages — MEDIUM confidence (community, not official)
- Stonemaier Games: "The Current State of Digital Versions of Tabletop Games (2024)" — MEDIUM confidence (publisher perspective)
- Board Game Arena spectator mode documentation — HIGH confidence (official platform feature)
- NFT News Today: "How to Analyze Play-to-Earn Game Economics" (Feb 2025) — MEDIUM confidence (industry analysis)
- Reason.com: "The Biggest NFT Video Game's Economy Is Collapsing" (2022) — HIGH confidence (documented collapse)
- Stardew Valley design analyses (multiple Medium/academic sources, 2023–2024) — MEDIUM confidence (secondary analysis)
- Spiritfarer relationship mechanic documentation (Springer Nature, 2024) — HIGH confidence (peer-reviewed)
- The Sims Wiki relationship decay documentation — HIGH confidence (official wiki, documented mechanic)
- Disco Elysium RPG System Analysis (Game Design Thinking) — MEDIUM confidence (secondary analysis)
- Sequence.xyz: "Common Mistakes When Developing Web3 Games" — MEDIUM confidence (industry practitioner)
- arXiv 2602.13882: "NFT Games: an Empirical Look into the Play-to-Earn Model" — HIGH confidence (empirical research)
