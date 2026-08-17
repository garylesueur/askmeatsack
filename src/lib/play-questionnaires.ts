import { createSessionSchema, type CreateSessionInput } from "./schema";

export const kerryPlayQuestionnaire: CreateSessionInput = createSessionSchema.parse({
  title: "Kickstart Learning leftover questions",
  context:
    "Kerry, leftover items after Sunday 16 August. Working list, not an audit. Short answers are fine. Chris is welcome on the HMRC question.\n\nThis is a **playground** copy on the preview. It is not the live link.",
  expiresInSeconds: 86_400,
  metadata: { play: "kerry-leftovers" },
  questions: [
    {
      id: "invoices_14d",
      prompt: "Which invoices do you expect to clear in the next 14 days?",
      detail:
        "Include anything Bucks asked you to hold until September. A short list in the comment is enough.",
      options: [
        { id: "will_list", label: "I will list them in the comment" },
        { id: "none", label: "None that I know of" },
        { id: "unsure", label: "Not sure" },
      ],
      allowComment: true,
      allowFiles: true,
    },
    {
      id: "equals",
      prompt: "What are the Equals cards generally used for?",
      detail:
        "A statement would help. Note anything leaving them before **31 August**.",
      options: [
        { id: "mix", label: "A mix (fuel, Amazon, materials, expenses)" },
        { id: "staff", label: "Mostly staff expenses" },
        { id: "ops", label: "Mostly day-to-day operating spend" },
        { id: "unsure", label: "Not sure" },
      ],
      allowComment: true,
      allowFiles: true,
    },
    {
      id: "flexipay",
      prompt: "Which FlexiPay figure should I use?",
      detail:
        "You said **£6,500** is left. The three dated repayments add to **£6,758.50**.\n\n```mermaid\nflowchart LR\n  said[You said 6500] --> pick{Which figure}\n  repay[Three repayments 6758.50] --> pick\n```",
      options: [
        { id: "6500", label: "£6,500 outstanding" },
        { id: "6758", label: "The three repayments (£6,758.50)" },
        { id: "unsure", label: "Not sure, I will check" },
      ],
      allowComment: true,
    },
    {
      id: "rebecca",
      prompt: "Is Rebecca Kathryn on the 31 August payroll?",
      detail: "If yes, roughly what net? Put the figure in the comment.",
      options: [
        { id: "yes", label: "Yes, she is on that run" },
        { id: "no", label: "No, she is not" },
        { id: "unsure", label: "Not sure" },
      ],
      allowComment: true,
    },
    {
      id: "hmrc",
      prompt: "What is the HMRC position after the letter?",
      detail:
        "Chris can take this one. A screenshot or the letter itself is welcome. Use the comment if a figure is unknown.",
      currency: "GBP",
      fields: [
        { id: "vat_ttp", label: "VAT on Time to Pay", input: "money" },
        { id: "vat_unplanned", label: "Unplanned VAT", input: "money" },
        { id: "paye_nic", label: "PAYE / NIC after the letter", input: "money" },
      ],
      allowComment: true,
      allowFiles: true,
    },
    {
      id: "bucks",
      prompt: "Please label these Buckinghamshire lines.",
      detail:
        "These are the buckinghamshire.gov amounts on the working list.\n\n```mermaid\nflowchart LR\n  bucks[buckinghamshire.gov] --> dd[Monthly DD]\n  bucks --> card[Monthly card]\n  bucks --> credits[Feb credits]\n```",
      currency: "GBP",
      items: [
        { id: "feb_dd", label: "Feb / Mar 2025", hint: "Direct debit", amount: "2476.80" },
        { id: "feb_card", label: "Feb / Mar 2025", hint: "Card", amount: "2477.00" },
        { id: "dec", label: "Dec 2025", amount: "840.00" },
        { id: "jan", label: "Jan 2026", amount: "660.00" },
        { id: "credit_81", label: "18 Feb 2026", hint: "Credit", amount: "81.00" },
        { id: "credit_588", label: "18 Feb 2026", hint: "Credit", amount: "588.00" },
      ],
      allowComment: true,
    },
    {
      id: "wenshi",
      prompt: "Was the Wenshi payment an Access to Work kit claim?",
      detail:
        "| Date | Amount | Direction |\n| --- | ---: | --- |\n| 5 May | £547.40 | Wenshi payment |\n| 23 June | £547.40 | DWP credit |",
      options: [
        { id: "yes_atw", label: "Yes, Access to Work kit" },
        { id: "no", label: "No, something else" },
        { id: "unsure", label: "Not sure" },
      ],
      allowComment: true,
    },
    {
      id: "paypal",
      prompt: "Can you upload a PayPal activity export?",
      detail:
        "January 2025 to January 2026, for the older Express Checkout direct debits. Not urgent if the mandate is now quiet.",
      options: [
        { id: "will_upload", label: "I will upload it" },
        { id: "later", label: "Not now" },
        { id: "quiet", label: "Mandate is quiet, skip for now" },
      ],
      required: false,
      allowComment: true,
      allowFiles: true,
    },
    {
      id: "dad_loan",
      prompt: "Is there anything in writing for the £20,000 from your dad?",
      detail: "The payment was on **27 July**. A text is enough.",
      options: [
        { id: "nothing", label: "Nothing in writing" },
        { id: "will_send", label: "I will send a note or screenshot" },
      ],
      allowComment: true,
      allowFiles: true,
    },
    {
      id: "shire",
      prompt: "Can we treat the Shire Leasing agreement as closed?",
      detail: "Nothing in 2026. Last cash was **19 July 2025**.",
      options: [
        { id: "closed", label: "Yes, paid off / closed" },
        { id: "still", label: "No, something is still on it" },
        { id: "unsure", label: "Not sure" },
      ],
      allowComment: true,
    },
    {
      id: "guarantor",
      prompt: "Who is the named guarantor on the Beaconsfield lease?",
      detail: "Skip if you do not know. A name in the comment is enough.",
      options: [
        { id: "will_name", label: "I will name them in the comment" },
        { id: "unknown", label: "I do not know" },
      ],
      required: false,
      allowComment: true,
    },
  ],
});
