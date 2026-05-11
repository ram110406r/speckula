"use client";

import { FlaskConical } from "lucide-react";
import { PlaceholderView } from "./_PlaceholderView";

export function ExperimentsView() {
  return (
    <PlaceholderView
      icon={FlaskConical}
      title="Experiments"
      description="Design, track, and learn from product experiments. Close the loop from hypothesis to outcome — powered by your Product Brain data."
      section="DECISION ENGINE"
    />
  );
}
