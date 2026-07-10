import { defaultDisplaySettings, type ApiProvider, type ReaderSettings, type TopicDisguiseTheme } from "../domain/types";

export type SettingsDraft = Omit<ReaderSettings, "display" | "topicDisguiseTheme"> & {
  display?: ReaderSettings["display"];
  topicDisguiseTheme?: TopicDisguiseTheme;
  sessionKeys?: Partial<Record<ApiProvider, string>>;
};

export function toPersistedSettings(settings: SettingsDraft): ReaderSettings {
  return {
    skin: settings.skin,
    bossKeyTarget: settings.bossKeyTarget,
    apiPolishEnabled: settings.apiPolishEnabled,
    minChunkChars: settings.minChunkChars,
    maxChunkChars: settings.maxChunkChars,
    interruptionEvery: settings.interruptionEvery,
    topicDisguiseTheme: settings.topicDisguiseTheme ?? "work",
    display: settings.display ?? defaultDisplaySettings,
  };
}

export function toPlatformSettingsPayload(settings: SettingsDraft): ReaderSettings {
  return toPersistedSettings(settings);
}
