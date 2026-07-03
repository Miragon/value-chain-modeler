# WKD/VACD notation reference

Grounded in the German Wikipedia article ["Wertschöpfungskettendiagramm"](https://de.wikipedia.org/wiki/Wertsch%C3%B6pfungskettendiagramm)
and the ARIS value-added chain diagram (VACD) method. This project implements the modern,
edge-based variant (no nested block arrows).

## Shapes

| Element  | Shape                                                            | Default size |
| -------- | ---------------------------------------------------------------- | ------------ |
| Step     | Right-pointing chevron: flat top/bottom, point right, notch left | 160×60       |
| Org unit | Ellipse                                                          | 130×60       |

Chevron geometry: point/notch depth `d = min(height/2, 0.4·width)` (45° edges at default
proportions). White fill, near-black stroke `hsl(225, 10%, 15%)`, 2px, round joins — the
bpmn.io design language. An optional `color` tints stroke and label.

## Relations

| Relation     | Meaning                              | Rendering                                    |
| ------------ | ------------------------------------ | -------------------------------------------- |
| `sequence`   | "ist Vorgänger von"                  | dashed (8,5), arrowhead into left notch      |
| `hierarchy`  | "ist prozessorientiert übergeordnet" | solid, arrowhead, exits parent bottom-center |
| `assignment` | org unit performs/owns a step        | plain solid line, no arrowhead               |

### Hierarchy routing (adaptive, group-aware)

Every hierarchy edge exits the parent at its **bottom center**. What happens next depends on
the arrangement of ALL sub-steps of that parent (shared predicate — routing and auto-placement
never disagree):

- **Row** (sub-steps with aligned tops, or a single sub-step under the parent's span):
  short vertical stub → horizontal bus halfway to the children → vertical drop with arrow
  into each sub-step's **top edge**. Children directly under the exit get a straight line.
- **Column** (the default when appending): stub → bus → across to a shared **trunk** 25px
  left of the leftmost sub-step → down → horizontal arm with arrow into each sub-step's
  **left notch** (the classic ARIS rake).

Moving any sibling re-routes the whole group (one undo step). Sequence and assignment edges
are straight lines between shape midpoints, cropped at the exact shape contours; user-set
interior bendpoints survive moves.

## Layout conventions

- Top-level chain: left→right, uniform gaps (~40–50px), same y.
- Sub-steps: either a row under the parent or a column indented ~70px right of the parent's
  left edge, 30px vertical gaps.
- Org units: centered below their step, ~45px gap.
- Grid: 10px snapping; minimum element size 80×40.

## Satellite objects (not yet implemented)

ARIS also attaches data objects, application systems, milestones, products, and risks to
steps. The schema is deliberately extensible (add an `elementType` variant); do not fake
them with mislabeled steps.
