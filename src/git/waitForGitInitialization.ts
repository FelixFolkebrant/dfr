export type GitApiState = "uninitialized" | "initialized";

export interface InitializingGitApi {
  readonly state: GitApiState;
  readonly onDidChangeState: (listener: (state: GitApiState) => void) => {
    dispose(): void;
  };
}

export async function waitForGitInitialization(
  api: InitializingGitApi,
): Promise<void> {
  if (api.state === "initialized") {
    return;
  }

  await new Promise<void>((resolve) => {
    const subscription = api.onDidChangeState((state) => {
      if (state === "initialized") {
        subscription.dispose();
        resolve();
      }
    });
  });
}
