import { createSessionSchema, type CreateSessionInput } from "./schema";
import type { z } from "zod";

type DemoPack = z.input<typeof createSessionSchema>;

export const demoQuestionnaires: DemoPack[] = [
  {
    title: "A small interrogation",
    context:
      "This is a real questionnaire. Submit and you will see what the agent would get back.",
    expiresInSeconds: 3600,
    metadata: { demo: "homepage" },
    questions: [
      {
        id: "biscuit",
        prompt: "Which of these is legally a biscuit?",
        detail:
          "A Jaffa Cake is a cake that thinks it is a biscuit.\n\n```mermaid\nflowchart LR\n  sponge --> chocolate\n  chocolate --> orange\n```",
        options: [
          { id: "jaffa", label: "A Jaffa Cake" },
          { id: "digestive", label: "A digestive" },
          { id: "trap", label: "This is a trap" },
        ],
        recommendedOptionId: "trap",
      },
      {
        id: "stuck",
        prompt: "Your agent is stuck. What should it do?",
        options: [
          { id: "ask", label: "Ask a human (that is this site)" },
          { id: "invent", label: "Invent a confident answer" },
          { id: "restart", label: "Restart Cursor and hope" },
        ],
      },
      {
        id: "instead",
        prompt: "What should we have asked instead?",
        options: [],
        required: false,
      },
    ],
  },
  {
    title: "Priorities",
    context: "Answer as yourself. The agent only sees what you submit.",
    expiresInSeconds: 3600,
    metadata: { demo: "homepage" },
    appearance: { theme: "grove" },
    questions: [
      {
        id: "fire",
        prompt: "First thing you would save in a fire",
        options: [
          { id: "laptop", label: "The laptop" },
          { id: "kettle", label: "The kettle" },
          { id: "dog", label: "The dog" },
          { id: "this", label: "This questionnaire" },
        ],
      },
      {
        id: "tabs",
        prompt: "Tabs or spaces?",
        options: [
          { id: "tabs", label: "Tabs" },
          { id: "spaces", label: "Spaces" },
          { id: "formatter", label: "I let the formatter decide" },
        ],
        recommendedOptionId: "formatter",
      },
    ],
  },
  {
    title: "Taste",
    context: "There is no wrong answer. There are several unpopular ones.",
    expiresInSeconds: 3600,
    metadata: { demo: "homepage" },
    appearance: { theme: "paper" },
    questions: [
      {
        id: "pineapple",
        prompt: "Pineapple on pizza",
        options: [
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
          { id: "holiday", label: "Only on holiday" },
        ],
      },
      {
        id: "feel",
        prompt: "An agent just asked you this. How do you feel?",
        options: [
          { id: "fine", label: "Fine" },
          { id: "watched", label: "Slightly watched" },
          { id: "sandwich", label: "I would like a sandwich" },
        ],
      },
    ],
  },
  {
    title: "Shipping",
    context: "Treat this like a real product decision. It is not one.",
    expiresInSeconds: 3600,
    metadata: { demo: "homepage" },
    appearance: { theme: "ember" },
    questions: [
      {
        id: "ship",
        prompt: "Ship it?",
        options: [
          { id: "yes", label: "Yes" },
          { id: "not-yet", label: "Not yet" },
          { id: "already", label: "It is already in production" },
        ],
        recommendedOptionId: "yes",
      },
      {
        id: "name",
        prompt: "Better name for this product",
        options: [],
        required: false,
      },
    ],
  },
  {
    title: "A leftover brief",
    context:
      "Working list, not an audit. Short answers are fine. The situation sits beside the question.",
    expiresInSeconds: 3600,
    metadata: { demo: "homepage" },
    appearance: { theme: "ask" },
    questions: [
      {
        id: "bucks",
        prompt: "Please label these Buckinghamshire lines.",
        detail:
          "Say what each line is in the comment.\n\n| Date | Amount | How |\n| --- | ---: | --- |\n| Feb / Mar 2025 | 2476.80 | Direct debit |\n| Feb / Mar 2025 | 2477.00 | Card |\n| Dec 2025 | 840.00 | |\n| Jan 2026 | 660.00 | |\n| 18 Feb 2026 | 81.00 | Credit |\n| 18 Feb 2026 | 588.00 | Credit |\n\n```mermaid\nflowchart LR\n  bucks[buckinghamshire.gov] --> dd[Monthly DD]\n  bucks --> card[Monthly card]\n  bucks --> credits[Feb credits]\n```",
        options: [
          { id: "will_label", label: "I will label them in the comment" },
          { id: "unsure", label: "Not sure" },
        ],
        allowComment: true,
      },
      {
        id: "flexipay",
        prompt: "Which FlexiPay figure should I use?",
        detail:
          "You said **6500** is left. The three dated repayments add to **6758.50**.",
        options: [
          { id: "6500", label: "6500 outstanding" },
          { id: "6758", label: "The three repayments (6758.50)" },
          { id: "unsure", label: "Not sure, I will check" },
        ],
        allowComment: true,
      },
    ],
  },
];

export function pickDemoQuestionnaire(
  random: () => number = Math.random,
): CreateSessionInput {
  const index = Math.floor(random() * demoQuestionnaires.length);
  const picked = demoQuestionnaires[index] ?? demoQuestionnaires[0];
  return createSessionSchema.parse(picked);
}
