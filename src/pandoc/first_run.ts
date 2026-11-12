import type PandocGuiPlugin from '../main';
import { createEnv } from '../settings';
import { isMobile, vaultRoot } from '../system/platform';
import { getPlatformValue } from '../system/utils';
import { resolveEngine } from './engine';
import pandoc from './pandoc';

export async function conversionSetup(plugin: PandocGuiPlugin) {
  const { settings } = plugin;
  const engine = resolveEngine(settings.engineMode, isMobile());
  if (engine === 'wasm') {
    return { engine, ready: await plugin.wasm.isInstalled() };
  }

  const root = vaultRoot(plugin.app.vault.adapter);
  const env = createEnv(getPlatformValue(settings.env) ?? {}, { pluginDir: `${root}/${plugin.manifest.dir}` });
  const version = await pandoc.getCachedVersion(getPlatformValue(settings.pandocPath), env).catch((): undefined => undefined);
  return { engine, ready: !!version };
}
