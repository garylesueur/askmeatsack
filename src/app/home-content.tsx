import type { Step, UseCase } from "@/components/home-sections";

/** The words. Everything structural lives in the shared components. */

export const HERO = {
  eyebrow: "MCP · Skill · HTTP",
  steps: [
    {
      n: "Step 1",
      heading: "The agent creates",
      body: "One call builds the questionnaire and returns a link. No project to set up, no dashboard to learn.",
    },
    {
      n: "Step 2",
      heading: "You answer in a browser",
      body: "Radio buttons, free text, money, file uploads. It works on a phone. The agent waits while you think.",
    },
    {
      n: "Step 3",
      heading: "The agent reads it back",
      body: "Answers arrive as structured JSON the moment you submit, and the agent carries on from where it stopped.",
    },
  ] satisfies Step[],
};

export const USE_CASES: UseCase[] = [
  {
    tag: "Deploy gate",
    heading: "Stop before production",
    body: "The agent has the release ready and will not push it on its own.",
    quote: "“14 commits to prod — ship or hold?”",
  },
  {
    tag: "Ambiguity",
    heading: "The spec did not say",
    body: "Halfway through a build it hits a case nobody wrote down. Asking beats guessing and rewriting later.",
    quote: "“Soft delete or hard delete?”",
  },
  {
    tag: "Judgement",
    heading: "Pick the wording",
    body: "The agent drafts three release notes. You pick one in four seconds instead of editing prose in chat.",
    quote: "“Which of these three?”",
  },
  {
    tag: "Money",
    heading: "Approve the spend",
    body: "A real money field with a currency, so what comes back is a number rather than a sentence.",
    quote: "“£240/mo for the bigger box?”",
  },
  {
    tag: "Unattended",
    heading: "One form per person",
    body: "A nightly job creates a separate questionnaire for every name on a list and collects them as they land.",
  },
  {
    tag: "Evidence",
    heading: "Ask for the file",
    body: "Request the screenshot or the export. The upload comes back attached to that answer.",
  },
];

/**
 * The one question the seam shows, on both sides.
 *
 * Both panels are built from this, so the JSON on the left and the form on the
 * right cannot disagree — they previously did, the agent sending two options
 * while the person was shown three, with different wording.
 */
export const SEAM_QUESTION = {
  title: "Ship it?",
  prompt: "14 commits are staged for production.",
  options: [
    { id: "ship", label: "Ship it now" },
    { id: "hold", label: "Hold until Monday" },
    { id: "look", label: "Let me look first" },
  ],
  /** Which one the person has picked, so the panel shows a real answer. */
  picked: "ship",
} as const;

const PUNCT = "text-machine-muted";
const KEY = "text-sky-300";
const VALUE = "text-emerald-300";

/**
 * The same question as a tool call. Tagged rather than interpolated, so the
 * sample can never be parsed as markup.
 */
export const AGENT_SAMPLE: [string, string][] = [
  [PUNCT, "// the agent stops and asks\n"],
  [PUNCT, "{\n  "],
  [KEY, '"title"'],
  [PUNCT, ": "],
  [VALUE, `"${SEAM_QUESTION.title}"`],
  [PUNCT, ",\n  "],
  [KEY, '"questions"'],
  [PUNCT, ": [{\n    "],
  [KEY, '"prompt"'],
  [PUNCT, ": "],
  [VALUE, `"${SEAM_QUESTION.prompt}"`],
  [PUNCT, ",\n    "],
  [KEY, '"options"'],
  [PUNCT, ": ["],
  ...SEAM_QUESTION.options.flatMap((option, index): [string, string][] => [
    [PUNCT, `\n      { "id": "${option.id}", "label": `],
    [VALUE, `"${option.label}"`],
    [PUNCT, index === SEAM_QUESTION.options.length - 1 ? " }" : " },"],
  ]),
  [PUNCT, "\n    ]\n  }]\n}"],
];
