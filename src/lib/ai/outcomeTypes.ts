export interface ExpectedOutcome {
  target_value: string;
  metric: string;
  timeframe: string;
}

export interface ActualOutcome {
  value: string;
  metric: string;
  observedAt: string;
}

export interface OutcomeFeedback {
  decisionId: string;
  success: boolean;
  expected: ExpectedOutcome;
  actual: ActualOutcome;
}
