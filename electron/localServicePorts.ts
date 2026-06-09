export const LOCAL_SERVICE_PORT = 17661;

export type PortStatus = "free" | "novel-chat" | "occupied";

export type LocalServicePortChoice = {
  port: number;
  reuseExisting: boolean;
};

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
