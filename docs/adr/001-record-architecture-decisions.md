# 001. Record architecture decisions

- Status: Accepted
- Date: 2026-10-06

## Context

The project makes a number of non-obvious decisions (money representation, session model,
transport abstraction, client layering). Without a record, the reasons get lost and decisions
get re-litigated or silently broken.

## Decision

Every architecturally significant decision is recorded as an ADR in `docs/adr/`:

- format: MADR (see [000-template.md](000-template.md));
- file name: `NNN-kebab-case-title.md`, numbered sequentially;
- statuses: `Proposed`, `Accepted`, `Superseded by NNN`;
- until the first release an ADR is edited in place, so one record holds the current decision
  and every option that was considered; after the first release a changed decision gets a new
  ADR that supersedes the old one;
- the index in [README.md](README.md) lists every ADR.

## Considered options

- **ADRs in the repository** — versioned with the code, reviewed in pull requests. Chosen.
- **Decisions in README / wiki** — drift from the code, no history per decision.
- **No written record** — knowledge lives only in people's heads.

## Consequences

- Reviewers can check a change against the recorded decisions.
- Changing a decision requires writing it down, which costs a little time.
