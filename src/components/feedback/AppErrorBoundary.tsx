import { Component, type ReactNode } from "react";
import { Btn } from "@/components/buttons/Btn";
import { EmptyState } from "@/components/EmptyState";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main role="alert" className="min-h-dvh p-4 sm:p-8" style={{ backgroundColor: "var(--background)" }}>
      <div className="mx-auto max-w-6xl">
        <EmptyState title="This page could not be displayed" description="Try opening the application again. If you were submitting a transaction, check its history before retrying."
          action={<div className="flex flex-wrap justify-center gap-2">
            <Btn onClick={() => this.setState({ failed: false })}>Try again</Btn>
            <Btn variant="secondary" onClick={() => window.location.reload()}>Reload application</Btn>
          </div>} />
      </div>
    </main>;
  }
}
