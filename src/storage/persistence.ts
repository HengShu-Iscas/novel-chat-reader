import type { ApiProvider, ReaderSettings } from "../domain/types";

export type SettingsDraft = ReaderSettings & {
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
  };
}

export function toPlatformSettingsPayload(settings: SettingsDraft): ReaderSettings {
  return toPersistedSettings(settings);
}
