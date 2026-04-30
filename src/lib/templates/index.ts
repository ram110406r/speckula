import type { JSONContent } from "@tiptap/react";

export interface SpeckulaTemplate {
  id: "user-interview" | "support-tickets" | "feature-request" | "blank";
  label: string;
  description: string;
  icon: string;
  content: JSONContent;
}

const heading = (text: string): JSONContent => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});

const placeholder = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const buildDoc = (sections: Array<{ heading: string; placeholder: string }>): JSONContent => ({
  type: "doc",
  content: sections.flatMap((section) => [
    heading(section.heading),
    placeholder(section.placeholder),
  ]),
});

export const TEMPLATES: SpeckulaTemplate[] = [
  {
    id: "user-interview",
    label: "User Interview",
    description: "Capture interview notes with structure the AI can mine for signals.",
    icon: "Users",
    content: buildDoc([
      { heading: "Participant", placeholder: "Name, role, company, date of interview." },
      { heading: "Key Pain Points", placeholder: "What problems did they describe? Quote directly where possible." },
      { heading: "Current Workflow", placeholder: "How do they handle this today? What tools do they use?" },
      { heading: "Desired Outcomes", placeholder: "What would success look like for them?" },
      { heading: "Notable Quotes", placeholder: "Paste verbatim quotes here — the AI uses these as evidence." },
      { heading: "Signals", placeholder: "Anything surprising, recurring, or worth flagging." },
    ]),
  },
  {
    id: "support-tickets",
    label: "Support Tickets",
    description: "Drop in raw tickets and let the AI segment patterns and severity.",
    icon: "MessageSquareWarning",
    content: buildDoc([
      { heading: "Source", placeholder: "Where are these tickets from? (Zendesk, Intercom, email, etc.) Date range." },
      { heading: "Raw Tickets", placeholder: "Paste ticket text here. One ticket per paragraph, or bulk paste. The AI will segment them." },
      { heading: "Patterns You've Noticed", placeholder: "Any recurring themes you spotted before running analysis?" },
      { heading: "Affected Segments", placeholder: "Which user types or plans are most represented?" },
      { heading: "Volume & Severity", placeholder: "How many tickets? Any blocking / critical reports?" },
    ]),
  },
  {
    id: "feature-request",
    label: "Feature Request",
    description: "Frame an inbound request around problem, evidence, and success metric.",
    icon: "Lightbulb",
    content: buildDoc([
      { heading: "The Request", placeholder: "Describe the feature being requested, in the user's own words if possible." },
      { heading: "Who Is Asking", placeholder: "Which users, segments, or accounts? How many?" },
      { heading: "The Problem Behind the Request", placeholder: "What underlying problem does this solve? Avoid jumping to solutions." },
      { heading: "Evidence", placeholder: "Quotes, ticket links, NPS comments, support volume — anything concrete." },
      { heading: "What We've Heard Before", placeholder: "Has this come up previously? What was decided and why?" },
      { heading: "Success Metric", placeholder: "How would we know if we solved this? What moves?" },
    ]),
  },
];

export const BLANK: SpeckulaTemplate = {
  id: "blank",
  label: "Start blank",
  description: "An empty canvas. Useful when you already know your structure.",
  icon: "FileText",
  content: {
    type: "doc",
    content: [{ type: "paragraph" }],
  },
};
