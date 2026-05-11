"use client";

import { Brain } from "lucide-react";
import { PlaceholderView } from "./_PlaceholderView";

export function ProductBrainView() {
  return (
    <PlaceholderView
      icon={Brain}
      title="Product Brain"
      description="Your startup's persistent memory. Stores and connects competitor insights, market signals, and PM decisions into a searchable knowledge graph."
      section="INTELLIGENCE"
    />
  );
}
