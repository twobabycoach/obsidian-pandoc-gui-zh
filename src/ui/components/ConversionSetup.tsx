import { createResource, createSignal, Show } from 'solid-js';
import type PandocGuiPlugin from '../../main';
import { conversionSetup } from '../../pandoc/first_run';
import { isMobile, openExternal } from '../../system/platform';
import { t } from '../../lang/helpers';
import Button from './Button';

export function useConversionSetup(plugin: PandocGuiPlugin) {
  const [status, { refetch }] = createResource(() => conversionSetup(plugin));
  return { status, refetch };
}

export default (props: {
  plugin: PandocGuiPlugin;
  setup: ReturnType<typeof useConversionSetup>;
  needsPdf?: boolean;
  chinesePdf?: boolean;
  onChange?: () => void;
}) => {
  const [progress, setProgress] = createSignal('');
  const [problem, setProblem] = createSignal('');
  const [installing, setInstalling] = createSignal<'pandoc' | 'pdf'>();
  const [hasWasm, { refetch: checkWasm }] = createResource(() => props.plugin.wasm.isInstalled());
  const { status, refetch } = props.setup;
  const action = () => !status.loading && (!status()?.ready ? 'pandoc' : props.needsPdf ? 'pdf' : undefined);
  const panel = () => installing() ?? action();

  const install = async () => {
    const kind = action();
    if (!kind || progress()) {
      return;
    }
    setInstalling(kind);
    const chinesePdf = props.chinesePdf;
    setProblem('');
    setProgress('正在准备安装…');
    const { plugin } = props;
    try {
      if (kind === 'pandoc') {
        if (!(await plugin.wasm.isInstalled())) {
          const release = await plugin.wasm.latest();
          if (!release) {
            throw new Error('暂时无法取得 Pandoc 下载地址。');
          }
          plugin.settings.wasmVersion = await plugin.wasm.install(release, stage => {
            setProgress(stage === 'downloading' ? '正在下载转换组件…' : stage === 'extracting' ? t.WASM_EXTRACTING : t.WASM_WRITING);
          });
        }
        await plugin.wasm.load();
        if (!isMobile()) {
          plugin.settings.engineMode = 'wasm';
        }
      } else {
        if (!(await plugin.typst.isInstalled())) {
          plugin.settings.typstVersion = await plugin.typst.install((stage, done, total) => {
            setProgress(stage === 'fonts' ? t.TYPST_FONTS(done, total) : stage === 'writing' ? t.TYPST_WRITING : t.TYPST_DOWNLOADING);
          });
        }
        if (chinesePdf) {
          setProgress('正在下载中文字体…');
          await plugin.typst.installChineseFonts();
        }
      }
      await plugin.saveSettings();
      await Promise.all([refetch(), checkWasm()]);
      props.onChange?.();
    } catch (error) {
      console.warn('笔记导出助手：安装失败', error);
      setProblem('安装失败。请确认网络可用后重试。');
    } finally {
      setProgress('');
      setInstalling(undefined);
    }
  };

  return (
    <Show when={panel()}>
      <div class="ex-zh-setup">
        <div>
          <strong>{panel() === 'pdf' ? '需要 PDF 排版组件' : '需要文档转换组件'}</strong>
          <p aria-live="polite">
            {progress() ||
              (panel() === 'pdf'
                ? props.chinesePdf
                  ? '首次使用需下载排版组件和中文字体，约 68 MB。安装后可离线导出。'
                  : t.TYPST_SIZE
                : hasWasm()
                  ? '已安装内置转换组件，可以直接启用。'
                  : t.WASM_SIZE)}
          </p>
          <Show when={problem()}>
            <p role="alert" class="ex-zh-error">
              {problem()}
            </p>
          </Show>
        </div>
        <div class="ex-zh-setup-actions">
          <Button cta disabled={!!progress()} onClick={() => void install()}>
            {panel() === 'pdf' ? '安装 PDF 组件' : hasWasm() ? '启用转换组件' : '安装转换组件'}
          </Button>
          <Show when={panel() === 'pandoc' && !isMobile()}>
            <Button disabled={!!progress()} onClick={() => openExternal('https://pandoc.org/installing.html')}>
              官网安装
            </Button>
            <Button disabled={!!progress()} onClick={() => void refetch()}>
              重新检测
            </Button>
          </Show>
        </div>
      </div>
    </Show>
  );
};
