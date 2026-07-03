---
name: value-chain-modeling
description: >-
  Value chain diagram (Wertschöpfungskettendiagramm, ARIS VACD) expert. Explains the notation
  (chevron steps, sequence/hierarchy relations, organizational units), reads and writes the
  project's *.vc.json document format, and reviews a user's process landscape — structure,
  granularity, decomposition depth, and responsibility assignment. Use whenever the user asks
  to create, review, critique, or restructure a value chain diagram; to explain the WKD/VACD
  notation; or to read/write *.vc.json files.
---

# Value Chain Modeling

A value chain diagram (Wertschöpfungskettendiagramm, WKD) shows an organization's business
processes at the **highest abstraction level**: which value-creating steps exist, in which
order they run, how they decompose into sub-chains, and who performs them. It goes back to
Michael Porter's value chain (1985) and is the top layer of an ARIS-style process landscape —
each step ideally drills down into a detailed model (EPC/BPMN) one level below.

## Elements and relations (the whole notation)

- **Step** (`elementType: "step"`) — a right-pointing chevron ("Blockpfeil"). The single
  workhorse: a value chain, main process, or sub-chain. Default 160×60.
- **Organizational unit** (`elementType: "orgUnit"`) — an ellipse, assigned to the step it
  performs or is responsible for. Placed below the step.
- **`sequence`** — "ist Vorgänger von": the process order between steps. Drawn **dashed with
  an arrowhead** from predecessor to successor, entering the successor's left notch.
- **`hierarchy`** — "ist prozessorientiert übergeordnet": decomposition of a step into
  sub-chains. Drawn **solid with an arrowhead**, always exiting the parent's **bottom
  center**. The editor routes adaptively based on how sub-steps are arranged:
  - sub-steps in a **horizontal row** below the parent → a bus with vertical drops into
    each sub-step's top;
  - sub-steps in a **vertical column** → a rake: down, across to a shared trunk left of the
    children, horizontal arms into each left notch.
- **`assignment`** — links an org unit to a step. Plain **solid line without arrowhead**.

Type matrix (enforced by validation and editor rules): `sequence`/`hierarchy` connect
step↔step only; `assignment` connects step↔orgUnit; org units never connect to each other.

Details and the visual reference: `reference/notation.md`. The JSON document format:
`reference/document-format.md`.

## How to review a value chain diagram (the core job)

1. **Read the file** (`*.vc.json`, validate mentally against the format) and build the
   structure: top-level chain (steps connected by `sequence`), decomposition trees
   (`hierarchy`), responsibilities (`assignment`).
2. **Check the top-level chain**: does it read left→right as a value stream toward the
   customer? Are the steps on the same granularity level (a classic mistake: "Procurement"
   next to "Send invoice")? Between 4 and 8 top-level steps is typical; more suggests
   missing decomposition.
3. **Check decomposition**: does every parent have 2+ sub-steps (a single sub-step is a
   renaming, not a decomposition)? Is the depth ≤ 2–3 (deeper belongs in a drill-down model,
   see the `link` field)? Are sub-chains sequenced where order matters?
4. **Check responsibilities**: does every top-level step have an org unit (or a deliberate
   reason not to)? Multiple org units on one step often signal an unresolved ownership
   question — worth calling out.
5. **Check semantics**: no cycles in `sequence`; hierarchy relations must not double as
   sequence; orphaned steps (no relation at all) are usually leftovers.
6. **Deliver feedback two ways**: a short written assessment (strengths / weaknesses /
   suggestions), and — when asked to fix — edited JSON that preserves ids, geometry, and all
   fields you are not deliberately changing. Prefer suggesting structural moves over silently
   applying them.

## Authoring new diagrams

Start from the customer-facing value stream: 4–8 top-level steps left→right connected with
`sequence` (spacing ~40–50px between chevrons, same y). Decompose only the steps the reader
needs to understand (hierarchy, sub-steps below the parent). Assign org units to top-level
steps. Keep labels short (2–3 words, noun or verb phrase — "Auftragsabwicklung", not a
sentence). Compute geometry honestly: steps 160×60 on a 10px grid; sub-step rows/columns per
`reference/notation.md`; connection waypoints can be rough — the editor re-crops and
re-routes hierarchy edges on the next interaction.

When you change a document, **round-trip everything you don't touch** — the serialization is
deterministic (sorted ids, sorted keys, 3-decimal rounding), so unnecessary rewrites show up
as diff noise.
