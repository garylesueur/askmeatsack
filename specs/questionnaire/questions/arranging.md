---
id: questionnaire-questions-arranging
area: Questionnaire / Questions
status: future
---

# Questions you answer by moving things

Some questions are badly served by a box to type in. *Is this the right order?* *Who owns
each of these steps?* *Is this flow acceptable?* — a person can answer all three far better
by moving things around than by describing, in prose, the change they would make. This spec
covers question kinds that are answered by arrangement, and what the agent gets back.

It extends [answering a questionnaire](../sessions/answering.md). Creating, delivery, one
question at a time, autosave, review, submit, expiry, waiting and callbacks are unchanged.

## Behaviours

### B1 — A question may ask for an order 🔵 future

A question can offer a set of rows and ask the person to put them in the right order. They
drag them, or move them with a control, and the order they leave is the answer. This is the
smallest arranging question and the one that works everywhere, including on a phone.

### B2 — A question may ask for things to be sorted into groups 🔵 future

A question can offer a set of rows and a set of groups — owners, phases, keep and drop — and
ask the person to put each row into one. The answer is which row went where. Rows the person
did not place are reported as unplaced rather than quietly assigned.

### B3 — A question may ask for a flow to be changed 🔵 future

A question can carry a flow as a single ordered sequence of steps and ask the person to
change it. They can move a step, take one out, and put one in from those the agent offered.
The sequence they leave behind is the answer. A step never has two ways out of it — see the
settled question below, and the product says "put these steps in order" rather than "edit
this flow", because the second promises something it does not do.

### B4 — The agent sends the flow as steps, not as a picture 🔵 future

The agent supplies the steps and the links between them, and this service draws the diagram.
It does not send a diagram and hope to get one back. A person is never asked to edit
diagramming source, and an agent is never handed a redrawn picture to interpret.

### B5 — The agent offers what may be added 🔵 future

Steps a person may add come from a list the agent supplies. Arranging stays inside a
vocabulary the agent already understands, so what comes back can be acted on rather than
guessed at. A question may also allow a step the person writes themselves, and when it does,
anything they wrote is marked in the answer as their words rather than the agent's.

### B6 — The answer says what changed, as well as what it now is 🔵 future

The agent receives both the arrangement the person left and the list of changes they made —
this step moved after that one, this step removed, this one added between those two. The
end state alone loses the intent, and asking the agent to work out the difference wastes
the one thing the person actually told us.

### B7 — Leaving it alone is an answer, and it is not the same as not answering 🔵 future

A person can say the arrangement is right as it stands. That is an explicit answer and it is
different from having never touched the question. *Is this flow acceptable?* is only worth
asking if yes and silence do not look the same.

### B8 — A person who cannot fix it can still say so 🔵 future

An arranging question can carry a comment, so somebody who knows the flow is wrong but not
how to fix it can say that instead of inventing an arrangement they do not believe in. A
comment never substitutes for the arrangement when the question is required.

### B9 — Putting it back is always possible 🔵 future

A person can return the question to the arrangement it arrived in, at any point before
submit, without losing the rest of their answers. Nobody should be afraid to try moving
something.

### B10 — A phone gets the same question, not a worse one 🔵 future

On a narrow screen an arranging question is a list with controls to move, remove and add,
and links shown in words — *after approval*, *then payment* — rather than a diagram to drag
about. It is the same question and the same answer; only the way it is shown differs. There
is no pinching, and no dragging on a canvas.

### B11 — The person cannot leave it structurally broken 🔵 future

A person cannot produce something incoherent — a step following nothing, a link to a step
that is no longer there. What they can produce is something the agent disagrees with: this
service does not judge whether an arrangement is *good*, exactly as it does not score any
other answer.

### B12 — A machine can read the arrangement 🔵 future

The arrangement comes back in the same structured form the agent sent, alongside the changes
(B6), through the same answers the agent already reads. There is no second format to learn
and nothing to parse out of prose.

### B13 — A diagram can be opened bigger 🔵 future

Any diagram — in the material beside a question, or in an arranging question itself — can be
opened larger and closed again, on any screen. This is worth having on its own, before
anything here is built: a flow big enough to be worth asking about is usually too small to
read.

## Rules (Invariants)

- The agent sends structure and receives structure. Diagramming source is never the thing a
  person edits, and never the thing an agent gets back.
- What may be added comes from the agent, unless the question says otherwise, and anything a
  person wrote themselves is marked as theirs.
- Every arranging answer carries both the final arrangement and the changes that produced it.
- Accepting an arrangement unchanged is an explicit answer, distinguishable from an
  unanswered question.
- A person can always return a question to how it arrived.
- The same question and the same answer on every screen size. Presentation changes; the
  question does not.
- An arrangement is always structurally coherent. It is never judged for quality — this
  service does not score answers.
- Arranging questions obey everything else about a question: required or not, comment,
  files, autosave, freeze at submit.

## Decision Tables

### Which kind to ask

| The ask | Kind | What comes back |
| --- | --- | --- |
| Put these in the right order | Order (B1) | The rows, in the order left |
| Who owns each of these | Groups (B2) | Each row's group, and anything unplaced |
| Is this sequence right, and fix it if not | Flow (B3) | The sequence left behind, plus the changes made |
| Is this flow right, yes or no | A choice question with the flow as material | The choice |
| Tell me what you think of this page | Not this product — see showmeatsack.com annotations | Notes on the page |

### Answering a flow question

| What the person does | Outcome |
| --- | --- |
| Leaves it alone and accepts it | Recorded as accepted unchanged (B7) |
| Moves, removes or adds a step | The new sequence, and the list of changes (B6) |
| Adds a step of their own, where allowed | Included, marked as their words (B5) |
| Adds a step of their own, where not allowed | Not offered; they can say it in a comment (B8) |
| Puts it back to how it arrived | As if untouched, and still needs an answer (B9) |
| Leaves a required question untouched | Cannot submit, as with any required question |

## Open Questions

- **Settled 21 Aug 2026 — sequences only, and it is called what it is.** A flow question
  asks whether a single ordered sequence of steps is right. Branches are not in the first
  version: two paths out of one step with a condition on each is where most of the cost sits.
  The condition attached to that decision is the second half of the original question — the
  product says "put these steps in order", never "edit this flow", and B3's wording follows
  the same rule. Branching stays in Future Considerations, where the reasoning is kept.
- **Blocks B5:** Should a person be able to write a step nobody offered? It is the first
  thing a real colleague will want, and it is the thing that puts an answer outside the
  vocabulary the agent can act on. Marking it as theirs (B5) is probably enough, but the
  default needs deciding.
- Does an arranging question reuse the flow shape this estate already writes specs in —
  states, transitions, guards? It is tempting because the vocabulary exists, and it is
  probably over-fitting: a colleague being asked whether a process is right is not editing
  guards.
- Is the enlarged view (B13) also where arranging happens on a wide screen, or is enlarging
  strictly for reading?
- How much of a flow is too much to ask about? Ten steps is a question; sixty is a document
  somebody will not read.

## Future Considerations

- **Branching.** Two paths out of one step, each with a condition — *what happens when they
  refuse?* Designed away from the first version on 21 Aug 2026 rather than forgotten: it is
  where most of the cost of flow editing sits, and where the questions worth asking a
  colleague actually live. Adding it later changes what B3 accepts and what an answer means,
  so it is a version, not an increment.
- Marking a step as wrong without having to fix it, so disagreement can be precise without
  demanding a solution.
- Several people arranging the same flow, and the agent seeing where they disagreed —
  closer to what annotations do on showmeatsack.com.
- The agent sending its flow contract directly, if the estate's own `.flow.yaml` turns out
  to be the right shape after all.
- Handing the finished flow back as a diagram the agent can put straight into a document.

## Out of Scope

- A general drawing surface. Boxes and arrows anywhere, freehand, is
  [showmeatsack.com annotations](https://showmeatsack.com), not a questionnaire answer.
- Judging whether an arrangement is correct, sensible, or better than what was sent.
- Editing diagramming source, in either direction.
- Real-time arranging by several people at once.
- Anything that only works with a mouse.
