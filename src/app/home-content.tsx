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

/** A sample tool call, tagged rather than interpolated so it cannot be markup. */
export const AGENT_SAMPLE: [string, string][] = [
  ["text-machine-muted", "// the agent stops and asks\n"],
  ["text-machine-muted", "{\n  "],
  ["text-sky-300", '"title"'],
  ["text-machine-muted", ": "],
  ["text-emerald-300", '"Ship it?"'],
  ["text-machine-muted", ",\n  "],
  ["text-sky-300", '"questions"'],
  ["text-machine-muted", ": [{\n    "],
  ["text-sky-300", '"prompt"'],
  ["text-machine-muted", ": "],
  ["text-emerald-300", '"14 commits to prod"'],
  ["text-machine-muted", ",\n    "],
  ["text-sky-300", '"options"'],
  ["text-machine-muted", ": ["],
  ["text-emerald-300", '"Ship"'],
  ["text-machine-muted", ", "],
  ["text-emerald-300", '"Hold"'],
  ["text-machine-muted", "]\n  }]\n}"],
];
