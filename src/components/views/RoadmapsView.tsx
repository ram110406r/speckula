"use client";

import { GitBranch } from "lucide-react";
import { PlaceholderView } from "./_PlaceholderView";

export function RoadmapsView() {
  return (
    <PlaceholderView
      icon={GitBranch}
      title="Roadmaps"
      description="Visualise and plan your product roadmap. Generated from decisions, specifications, and experiments — with AI-driven prioritisation and dependency mapping."
      section="DECISION ENGINE"
    />
  );
}
