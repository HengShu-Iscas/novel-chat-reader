export type NovelFormat = "txt" | "epub";

export type SkinId = "chatgpt" | "gemini" | "deepseek" | "doubao";

export type BossKeyTarget = SkinId | "random-open-tab";

export type TopicDisguiseTheme =
  | "work"
  | "research"
  | "coding"
  | "product"
  | "operations"
  | "learning"
  | "finance"
  | "design"
  | "meetings"
  | "daily";

export type DisplayDensity = "compact" | "comfortable" | "spacious";

export type DisplaySettings = {
  fontScale: number;
  messageWidth: number;
  density: DisplayDensity;
  sidebarMode: "full" | "compact";
  composerPosition: "bottom" | "floating";
};

export const defaultDisplaySettings: DisplaySettings = {
  fontScale: 1,
  messageWidth: 760,
  density: "comfortable",
  sidebarMode: "full",
  composerPosition: "bottom",
};

export type Chapter = {
  id: string;
  title: string;
  text: string;
};

export type NovelSource = {
  id: string;
  title: string;
  format: NovelFormat;
  chapters: Chapter[];
  updatedAt: number;
};

export type ReaderSettings = {
  skin: SkinId;
  bossKeyTarget: BossKeyTarget;
  apiPolishEnabled: boolean;
  minChunkChars: number;
  maxChunkChars: number;
  interruptionEvery: number;
  topicDisguiseTheme: TopicDisguiseTheme;
  display: DisplaySettings;
};

export type ReaderState = {
  books: NovelSource[];
  activeBookId: string | null;
  activeChapterIndex: number;
  chapterReadOffset: number;
  settings: ReaderSettings;
};

export type ChatSegmentKind = "prose" | "interruption" | "chapter-transition";

export type ChatSegment = {
  id: string;
  role: "assistant" | "user";
  kind: ChatSegmentKind;
  text: string;
};

export type ApiProvider = "openai" | "gemini" | "deepseek" | "doubao";

export type ApiProviderConfig = {
  provider: ApiProvider;
  model: string;
  endpoint?: string;
};
