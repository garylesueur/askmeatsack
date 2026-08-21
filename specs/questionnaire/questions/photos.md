---
id: questionnaire-questions-photos
area: Questionnaire / Questions
status: future
---

# Asking somebody for photographs

A repairer asks for a photograph of the whole windscreen, and then a close-up of the chip.
An insurer asks for the damage and the registration plate. These are not *attach a file*
questions — they are a list of specific shots, each needing to show a particular thing, taken
by somebody standing in a car park holding a phone.

This extends [answering a questionnaire](../sessions/answering.md), where a question may
already accept files including a photograph (B25) and typed device capture is anticipated
(B33). What is missing is everything that makes a photograph *the right photograph*.

## Behaviours

### B1 — A question can ask for a named set of shots 🔵 future

A question can ask for several specific photographs — *the whole windscreen*, *a close-up of
the chip*, *the registration plate* — rather than for some files. Each shot is named by the
agent, and the person answering works through them one at a time.

### B2 — Every shot says what it is for, and shows what good looks like 🔵 future

A shot carries a short line saying what it needs to show, and the agent can supply an example
photograph. The example is visible while the person is framing the shot, not buried in
material they read two screens ago and have since walked away from.

### B3 — On a phone, the camera opens on the shot 🔵 future

Answering a shot opens the camera ready to take that photograph, with its name and example
to hand. It is not a file picker that happens to offer a camera among its options, and it
does not make somebody leave the questionnaire, take photographs, come back and work out
which was which.

### B4 — Photographs come back labelled 🔵 future

The agent receives each photograph against the shot it was taken for. It never has to work
out which of five files is the close-up. This is the difference between a photograph the
agent can act on and a bundle somebody has to open and sort.

### B5 — A photograph that cannot be used is caught while the person is still there 🔵 future

A photograph too dark, too blurred, or too small to be useful is flagged immediately, with
what is wrong in plain words, and the person can take another. Finding out days later that
the only photograph of the chip was unusable means asking somebody to go back out to their
car.

### B6 — Nobody is trapped by the checks 🔵 future

After a failed check a person can take another, choose one they already have, or say this is
the best they can get and move on. The photograph is kept either way, marked as one the
person was warned about. A checker that will not take yes for an answer is worse than no
checker.

### B7 — The kind of shot changes the help, not the judgement 🔵 future

A shot can say what kind it is — a whole object, a close-up of a detail, a document, or a
person — and that changes the framing guidance, what is checked, and how the example is
shown. It never changes whether the answer is accepted on its merits.

### B8 — This service never decides whether a photograph shows the right thing 🔵 future

Whether that is really a windscreen, whether the chip is within the driver's line of sight,
whether the document is genuine — none of that is decided here. The checks are mechanical:
light, focus, size. The agent that asked judges the content, exactly as it judges every other
answer.

### B9 — Photographs can be taken in more than one sitting 🔵 future

Shots taken so far are kept as the person goes, as every other answer is. Somebody can take
two photographs, walk back inside, and finish the rest later on the same link.

### B10 — No camera is not a dead end 🔵 future

On a desktop, or where camera permission is refused or unavailable, the person can choose an
existing photograph for the same shot, and it comes back labelled the same way. Nobody is
stopped from answering because of the device they opened the link on.

### B11 — Where a photograph was taken is not collected by accident 🔵 future

Location and similar metadata carried inside a photograph are removed before it is stored,
unless the question says it needs them — in which case the person is told, in plain words,
before they take it. A photograph of somebody's own car should not quietly hand over their
home address.

### B12 — A photograph of a person, or of their documents, is treated as what it is 🔵 future

A shot marked as a person or a document is the most sensitive thing this service will ever
hold. The person is told what it is for and how long it is kept, it is kept no longer than
the questionnaire needs it, and it is never used for anything but being the answer to that
question.

### B13 — Identity is never verified here 🔵 future

This service carries a photograph to the agent that asked for it. It does not check that a
face matches a document, does not check that a person is live, and does not confirm anybody
is who they say. An agent that needs that uses something built for it.

### B14 — What is asked for is bounded, and said up front 🔵 future

How many shots a question may ask for, and how large each photograph may be, are stated
before somebody starts rather than discovered on the last one. The existing limits on files
(B25 of [answering](../sessions/answering.md)) still apply to what is stored.

## Rules (Invariants)

- Every photograph is returned against the named shot it was taken for.
- Checks are mechanical — light, focus, size. Nothing here judges what a photograph depicts.
- A person can always proceed after a warning, and a warned photograph is kept and marked as
  warned.
- Location metadata is stripped unless the question needs it and the person has been told.
- A shot marked as a person or a document is kept for the shortest time that works, and its
  purpose is stated before it is taken.
- No answer path requires a camera. Choosing an existing photograph always works.
- The example a person is shown while framing comes from the agent, and is never mistaken for
  their own answer.
- Nothing here verifies identity, liveness, or authenticity.
- Everything else about a question still holds: required or not, comment, autosave, freeze at
  submit, malware checking before anything can be downloaded.

## Decision Tables

### What the kind of shot changes

| Kind | Framing help | Checked for | Never |
| --- | --- | --- | --- |
| A whole object | Fit the whole thing in | Light, focus, size | Whether it is that object |
| A close-up of a detail | Get close, hold steady | Focus especially | Whether the detail is there |
| A document | Flat, square on, corners in | Glare, focus, corners cut off | Whether it is genuine |
| A person | Face the camera, plain background | Light, focus | Who it is, or whether they are live |

### After a photograph is taken

| Situation | Outcome |
| --- | --- |
| Passes the checks | Kept against that shot |
| Too dark, blurred or small | Flagged with what is wrong; another can be taken |
| Warned, and the person continues anyway | Kept, marked as warned, and the agent is told |
| Camera unavailable or refused | An existing photograph can be chosen for the same shot |
| Some shots done, person leaves | Kept; the rest can be finished on the same link |
| A required shot never taken | Cannot submit, as with any required question |

## Open Questions

- **Blocks B12:** How long is a photograph of a person or a document kept? Asked on
  21 Aug 2026 and answered "90 days", which **cannot be recorded as settled** because it
  contradicts three things already written down: B12 itself says a photograph is kept no
  longer than the questionnaire needs it; a questionnaire lives 24 hours by default and
  7 days at the most; and the answering spec's invariants say sessions are ephemeral, the
  questionnaire is *gone* an hour after submit, expiry or cancel, and this product keeps no
  long-term archive of answers. Ninety days is also exactly lanyard's maximum token life,
  which is what makes it look like a number reached for by analogy.

  The real choice is narrower than it looks. Either a photograph dies with the questionnaire
  that asked for it — at most 7 days and 1 hour, and B12 needs no change — or photographs
  become the one thing this product retains beyond a session, which is a change to what
  askmeatsack *is* and needs the ephemerality invariant rewritten rather than quietly
  contradicted. **Still blocking. The most sensitive thing the product would hold should not
  acquire a retention period by accident.**
- **Blocks B1:** Can one shot hold several photographs — *the damage, from three angles* —
  or is each angle its own named shot? Named shots are clearer for the agent and longer for
  the person.
- Can the agent require a retake, or only warn? Requiring one would let an agent trap
  somebody in a car park at night, and B6 says it cannot. If the answer is ever yes, it needs
  an escape hatch that is not the person abandoning the questionnaire.
- Is a framing outline drawn over the camera worth building, or does an example beside the
  viewfinder do the job? The outline is what makes document capture feel professional, and it
  is a great deal of work per kind of shot.
- Does the agent get the mechanical check result alongside the photograph, so it knows a
  particular shot came back warned?

## Future Considerations

- A short video or a sweep around an object, where one photograph cannot show it.
- Guided outlines drawn on the viewfinder for documents and plates.
- Redacting on the device — blurring a face or a number — before anything is uploaded.
- Reading a plate or a serial number from the photograph and offering it back for the person
  to confirm, as an answer rather than as a judgement.
- Retaking a shot after submit, when the agent asks for one specific photograph again.

## Out of Scope

- Verifying identity, liveness, or that a document is genuine (B13).
- Deciding whether a photograph shows what was asked for (B8).
- Editing, cropping, enhancing or restoring photographs on the person's behalf.
- Storing photographs beyond the questionnaire they answered.
- Any path that requires an app, or that fails without a camera.
