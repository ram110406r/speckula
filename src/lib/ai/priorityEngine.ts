export function prioritizeSteps(steps: string[]) {
  return {
    high_priority: steps.slice(0, 1),
    medium: steps.slice(1, 3),
    low: steps.slice(3),
  };
}
