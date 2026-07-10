export const LOCAL_SERVICE_PORT = 17661;

export type PortStatus = "free" | "novel-chat" | "occupied";

export type LocalServicePortChoice = {
  port: number;
  reuseExisting: boolean;
};

export type HealthFetch = (url: string) => Promise<Response>;

export async function detectLocalServicePortStatus(
  port: number,
  fetchImpl: HealthFetch = fetch,
): Promise<PortStatus> {
  try {
    const response = await fetchImpl(`http://127.0.0.1:${port}/health`);
    if (!response.ok) return "occupied";
    const body = (await response.json()) as { name?: string; mode?: string };
    return body.name === "novel-chat-reader" && body.mode === "local-web" ? "novel-chat" : "occupied";
  } catch {
    return "free";
  }
}

export function chooseLocalServicePort(
  statuses: Record<number, PortStatus>,
  preferredPort = LOCAL_SERVICE_PORT,
  maxAttempts = 20,
): LocalServicePortChoice {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = preferredPort + offset;
    const status = statuses[port] ?? "free";

    if (status === "novel-chat") {
      return { port, reuseExisting: true };
    }

    if (status === "free") {
      return { port, reuseExisting: false };
    }
  }

  throw new Error(`No available NovelChat local service port found after ${maxAttempts} attempts`);
}
