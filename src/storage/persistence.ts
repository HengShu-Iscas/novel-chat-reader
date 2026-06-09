import { defaultDisplaySettings, type ApiProvider, type ReaderSettings } from "../domain/types";

export type SettingsDraft = Omit<ReaderSettings, "display"> & {
  display?: ReaderSettings["display"];
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
    display: settings.display ?? defaultDisplaySettings,
  };
}

export function toPlatformSettingsPayload(settings: SettingsDraft): ReaderSettings {
  return toPersistedSettings(settings);
}
