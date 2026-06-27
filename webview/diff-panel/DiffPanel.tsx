import { PatchDiff, Virtualizer } from "@pierre/diffs/react";
import { useEffect, useState } from "react";
import type {
  DiffPanelState,
  DiffPanelToExtensionMessage,
  ExtensionToDiffPanelMessage,
} from "../../src/webviews/protocol";

interface VsCodeApi {
  postMessage(message: DiffPanelToExtensionMessage): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

export function DiffPanel() {
  const [state, setState] = useState<DiffPanelState>({ status: "idle" });

  useEffect(() => {
    const receiveMessage = (
      event: MessageEvent<ExtensionToDiffPanelMessage>,
    ) => {
      if (event.data.type === "state") {
        setState(event.data.state);
      }
    };
    window.addEventListener("message", receiveMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", receiveMessage);
  }, []);

  if (state.status === "idle") {
    return <PanelMessage>Choose a changed file from the sidebar.</PanelMessage>;
  }

  if (state.status === "noSelection") {
    return (
      <PanelMessage baseRef={state.baseRef} headRef={state.headRef}>
        Choose a changed file from the sidebar.
      </PanelMessage>
    );
  }

  if (state.status === "loading") {
    return (
      <PanelMessage {...state} role="status">
        Loading {state.path}…
      </PanelMessage>
    );
  }

  if (state.status === "binary") {
    return (
      <PanelMessage {...state}>
        This binary file cannot be rendered as a text diff.
      </PanelMessage>
    );
  }

  if (state.status === "tooLarge") {
    return (
      <PanelMessage {...state}>
        This patch is {formatBytes(state.bytes)}, above the{" "}
        {formatBytes(state.maxBytes)} rendering limit.
      </PanelMessage>
    );
  }

  if (state.status === "error") {
    return (
      <PanelMessage {...state} role="alert">
        {state.message}
      </PanelMessage>
    );
  }

  return (
    <main className="diff-shell">
      <ReviewHeader {...state} />
      <Virtualizer className="diff-scroll" contentClassName="diff-content">
        <PatchDiff
          disableWorkerPool
          key={`${state.comparisonId}:${state.path}`}
          options={{ diffStyle: "unified" }}
          patch={state.patch}
        />
      </Virtualizer>
    </main>
  );
}

interface PanelMessageProps {
  baseRef?: string;
  headRef?: string;
  path?: string;
  role?: "alert" | "status";
  children: React.ReactNode;
}

function PanelMessage({
  baseRef,
  headRef,
  path,
  role,
  children,
}: PanelMessageProps) {
  return (
    <main className="message-shell">
      {baseRef && headRef && (
        <ReviewHeader baseRef={baseRef} headRef={headRef} path={path} />
      )}
      <section className="panel-message" role={role}>
        {children}
      </section>
    </main>
  );
}

function ReviewHeader({
  baseRef,
  headRef,
  path,
}: {
  baseRef: string;
  headRef: string;
  path?: string;
}) {
  return (
    <header className="review-header">
      <p>
        {headRef} into {baseRef}
      </p>
      {path && <h1>{path}</h1>}
    </header>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
