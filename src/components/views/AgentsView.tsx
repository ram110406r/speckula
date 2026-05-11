"use client";

import { Bot } from "lucide-react";
import { PlaceholderView } from "./_PlaceholderView";

export function AgentsView() {
  return (
    <PlaceholderView
      icon={Bot}
      title="Agents"
      description="Configurable AI agents that run research, track competitors, synthesise market signals, and surface insights — autonomously, on your schedule."
      section="AI SYSTEMS"
    />
  );
}
