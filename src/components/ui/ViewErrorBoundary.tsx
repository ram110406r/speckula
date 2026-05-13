"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  viewName?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ViewErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(
      `[ViewErrorBoundary] "${this.props.viewName ?? "view"}" crashed:`,
      error,
      info.componentStack
    );
    // Report to Sentry when available. Dynamic import keeps the bundle
    // unchanged in environments where @sentry/nextjs is not installed.
    import('@sentry/nextjs').then(({ captureException }) => {
      captureException(error, { extra: { viewName: this.props.viewName, componentStack: info.componentStack } });
    }).catch(() => undefined);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive/70" />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              {this.props.viewName
                ? `${this.props.viewName} failed to load`
                : "This view failed to load"}
            </p>
            <p className="max-w-sm break-all font-mono text-xs text-muted-foreground">
              {this.state.errorMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, errorMessage: "" })}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
