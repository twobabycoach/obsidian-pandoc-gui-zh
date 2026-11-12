import { Notice, TFile } from 'obsidian';
import { createSignal, createRoot, onCleanup, createMemo, createResource, untrack, Show, For } from 'solid-js';
import { insert } from 'solid-js/web';
import type PandocGuiPlugin from '../../main';
import { t } from '../../lang/helpers';
import { templateLabel } from '../../lang/formats';
import { referenceDoc } from '../../args/writer_args';
import ConversionSetup, { useConversionSetup } from '../components/ConversionSetup';
import Section from '../components/Section';
import VaultFileInput from '../components/VaultFileInput';
import { basename } from '../../system/paths';
import { extractDefaultExtension as extractExtension, applyExportChoices, type ExportChoices } from '../../settings';
import { setPlatformValue, getPlatformValue } from '../../system/utils';
import { exportNote } from '../../convert/export';
import { droppedBy, resolveEngine, unsupportedBy, writesTypstPdf } from '../../pandoc/engine';
import { outputFormat, supportsToc } from '../../pandoc/pandoc_format';
import { TOC_MAX_DEPTH, TOC_NONE, tocDepth } from '../../args/toc_args';
import { chooseFile, documentsFolder, fullPath, isMobile, isMobileUi, vaultRoot } from '../../system/platform';
import { shownDocuments } from '../../convert/joined_docs';
import FolderInput from '../components/FolderInput';
import DocumentList from '../components/DocumentList';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Setting, { Text, DropDown, Toggle } from '../components/Setting';
import StepSlider from '../components/StepSlider';

const JOIN_SIDES = ['before', 'after'] as const;
const JOIN_FILES = [{ name: 'Word 文档', extensions: ['docx', 'dotx'] }];
const QUICK_FORMATS = [
  { preset: 'Word (.docx)', icon: 'file-text', name: 'Word', description: '继续编辑' },
  { preset: 'PDF (Typst)', icon: 'file-type', name: 'PDF', description: '打印或分享' },
  { preset: 'Html', icon: 'globe', name: '网页', description: '用浏览器查看' },
];

const Dialog = (props: { plugin: PandocGuiPlugin; currentFile: TFile; onClose?: () => void }) => {
  const {
    plugin: { app, settings: globalSetting },
    currentFile,
  } = props;

  const [hidden, setHidden] = createSignal(false);
  const [running, setRunning] = createSignal(false);
  const setup = useConversionSetup(props.plugin);
  const [pdf, { refetch: checkPdf }] = createResource(async () => {
    const { typst } = props.plugin;
    const installed = await typst.isInstalled();
    return { installed, chinese: installed && (await typst.hasChineseFonts()) };
  });
  const [showOverwriteConfirmation, setShowOverwriteConfirmation] = createSignal(globalSetting.showOverwriteConfirmation);

  // Only the templates this engine can actually run: a PDF has no answer where there is no typesetter to make one.
  const engine = () => setup.status()?.engine ?? resolveEngine(globalSetting.engineMode, isMobile());
  const available = createMemo(() => globalSetting.items.filter(o => !unsupportedBy(o, engine())));
  const quickOptions = createMemo(() =>
    QUICK_FORMATS.flatMap(format => {
      const template = available().find(item => item.name === format.preset && item.preset === format.preset);
      return template ? [{ ...format, template }] : [];
    })
  );
  /** Templates were written, and this engine runs none of them — which is not the same as having written none. */
  const allHidden = () => globalSetting.items.length > 0 && available().length === 0;

  // The template last exported with, where it is still a template this engine runs: it is remembered by name, and a
  // deleted or renamed one would leave this pointing at nothing.
  const [exportType, setExportType] = createSignal(
    available().find(o => o.name === globalSetting.lastExportType)?.name ?? quickOptions()[0]?.template.name ?? available()[0]?.name
  );
  const setting = createMemo(() => available().find(o => o.name === exportType()) ?? quickOptions()[0]?.template ?? available()[0]);
  /** The last export's choices, for the template they were made for. */
  const remembered = exportType() === globalSetting.lastExportType ? globalSetting.lastExportChoices : undefined;
  const extension = createMemo(() => (setting() ? extractExtension(setting()) : ''));

  // What this template asks for that the engine will not do. It is not a reason to stop — the file is written, just
  // without them — so it is said here, where the template can still be changed, and the button says what it is agreeing to.
  const dropped = createMemo(() => (setting() ? droppedBy(setting(), engine()) : []));

  // The table of contents, for the templates that are a pandoc command line — a custom one is a command of its own,
  // with nothing here to read a `--toc` out of.
  const pandocSetting = createMemo(() => {
    const chosen = setting();
    return chosen?.type === 'pandoc' ? chosen : undefined;
  });
  const format = createMemo(() => {
    const chosen = pandocSetting();
    return chosen && outputFormat(chosen.arguments, chosen.customArguments, chosen.userArguments);
  });
  /** The depth this export asks for, where it asks for one of its own; the template's own until then. */
  const [tocOverride, setTocOverride] = createSignal<number | undefined>(remembered?.toc);
  const toc = () => tocOverride() ?? tocDepth(pandocSetting()?.customArguments);
  /** None, then one heading level at a time, as the template editor's own row offers them. */
  const tocLabels = [t.TOC_NONE, ...Array.from({ length: TOC_MAX_DEPTH }, (_, i) => String(i + 1))];

  /** The documents joined to a Word export: shown as the note or template names them until the list is changed here. */
  const [joinChosen, setJoinChosen] = createSignal<{ before?: string[]; after?: string[] }>(remembered?.join ?? {});
  const joinShown = createMemo(() => shownDocuments(pandocSetting() ?? {}, app.metadataCache.getFileCache(currentFile)?.frontmatter));
  const joinValue = (side: 'before' | 'after') => joinChosen()[side] ?? joinShown()[side];
  const chooseJoin = (side: 'before' | 'after', value: string[]) => setJoinChosen(chosen => ({ ...chosen, [side]: value }));

  const [reference, setReference] = createSignal<string | undefined>(remembered?.reference);
  const activeReference = () =>
    reference() ?? referenceDoc(pandocSetting()?.userArguments) ?? referenceDoc(pandocSetting()?.customArguments) ?? '';
  const usesTypst = () => !!setting() && writesTypstPdf(setting());
  const quickPdf = () => setting()?.name === 'PDF (Typst)' && usesTypst();
  const requiresTypst = () => quickPdf() || (engine() === 'wasm' && usesTypst());
  const needsPdf = () => requiresTypst() && !pdf.loading && (!pdf()?.installed || (quickPdf() && !pdf()?.chinese));
  const selectTemplate = (name: string) => {
    if (name !== setting()?.name) {
      setExportType(name);
      setTocOverride(undefined);
      setJoinChosen({});
      setReference(undefined);
    }
  };
  const choices = (): ExportChoices => ({
    toc: tocOverride(),
    join: joinChosen(),
    reference: reference(),
    quickPdf: quickPdf() || undefined,
  });
  /** What the export runs: the template, carrying what this dialog asks for where that is not its own. */
  const exportSetting = () => applyExportChoices(setting(), choices());

  // Where the file goes, as a path on the device. A phone has nowhere outside the vault to write to, so there it is
  // always one of the vault's own folders — held as a vault path, and turned into a real one at export.
  const vaultDir = vaultRoot(currentFile.vault.adapter);
  const [candidateOutputDirectory, setCandidateOutputDirectory] = createSignal(
    getPlatformValue(globalSetting.lastExportDirectory) ?? vaultDir
  );
  const vaultFolder = createMemo(() => {
    const inside = candidateOutputDirectory()?.startsWith(`${vaultDir}/`);
    return inside ? candidateOutputDirectory().substring(vaultDir.length + 1) : '';
  });
  const setVaultFolder = (folder: string) => setCandidateOutputDirectory(folder ? `${vaultDir}/${folder}` : vaultDir);
  // The name only — the extension is the template's, and is put back on at export.
  const [candidateOutputFileName, setCandidateOutputFileName] = createSignal(currentFile.basename);

  /** The name as it will be written, extension and all. */
  const outputStem = () => {
    const name = candidateOutputFileName().trim() || currentFile.basename;
    const ext = extension();
    return ext && name.toLowerCase().endsWith(ext.toLowerCase()) ? name.slice(0, -ext.length) : name;
  };
  const outputFileFullName = () => `${outputStem()}${extension()}`;

  const exportTypes = createMemo(() =>
    available()
      .map(o => ({ name: templateLabel(o.name, o.preset), value: o.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  );

  if (globalSetting.defaultExportDirectoryMode === 'Same') {
    setCandidateOutputDirectory(fullPath(currentFile.vault.adapter, currentFile.parent?.path ?? ''));
  } else if (globalSetting.defaultExportDirectoryMode === 'Custom') {
    setCandidateOutputDirectory(getPlatformValue(globalSetting.customDefaultExportDirectory) ?? vaultDir);
  }

  const chooseFolder = async () => {
    const chosen = await chooseFile({ folder: true, defaultPath: candidateOutputDirectory() ?? (await documentsFolder()) });
    if (chosen) {
      setCandidateOutputDirectory(chosen);
    }
  };

  const invalidName = () => !outputStem() || /^[. ]+$/.test(outputStem()) || /[\u0000-\u001f/\\:*?"<>|]/.test(outputStem());
  const [details, setDetails] = createSignal(quickOptions().length === 0);
  const canExport = () =>
    !!setting() && !!setup.status()?.ready && !needsPdf() && !(requiresTypst() && pdf.loading) && !running() && !invalidName();
  const doExport = async () => {
    if (!untrack(canExport)) {
      return;
    }
    const plugin = props.plugin;
    // What the dialog remembers of an export that worked, saved before it closes.
    const remember = async () => {
      globalSetting.showOverwriteConfirmation = untrack(showOverwriteConfirmation);
      globalSetting.lastExportDirectory = setPlatformValue(globalSetting.lastExportDirectory, untrack(candidateOutputDirectory));

      globalSetting.lastExportType = untrack(setting).name;
      globalSetting.lastExportChoices = untrack(choices);
      await plugin.saveSettings();
      props.onClose?.();
    };
    setRunning(true);
    try {
      await exportNote(
        plugin,
        currentFile,
        untrack(candidateOutputDirectory),
        untrack(outputFileFullName),
        untrack(exportSetting),
        untrack(showOverwriteConfirmation),
        // The dialog asks for no options of its own, so `${options.…}` reads as unset.
        {},
        () => void remember(),
        () => {
          setHidden(false);
        },
        () => setHidden(true)
      );
    } catch (error) {
      console.error(error);
      new Notice('无法导出。请检查保存位置后重试。');
      setHidden(false);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Modal app={app} title={t.EXPORT_DIALOG_TITLE} hidden={hidden()} classList={{ 'ex-export-modal': true }} onClose={props.onClose}>
        <div class="ex-zh-source">{currentFile.name}</div>

        <Show when={quickOptions().length > 0}>
          <div class="ex-zh-formats" role="group" aria-label="常用格式">
            <For each={quickOptions()}>
              {option => (
                <button
                  type="button"
                  class="ex-zh-format"
                  aria-pressed={setting()?.name === option.template.name}
                  onClick={() => selectTemplate(option.template.name)}
                >
                  <Icon name={option.icon} />
                  <span>
                    <strong>{option.name}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={setting()}>
          <div class="ex-zh-destination">
            <span>
              将保存为 <strong>{outputFileFullName()}</strong>
            </span>
            <span title={candidateOutputDirectory()}>
              {candidateOutputDirectory() === fullPath(currentFile.vault.adapter, currentFile.parent?.path ?? '')
                ? '笔记所在文件夹'
                : basename(candidateOutputDirectory()) || '笔记库根目录'}
            </span>
          </div>
        </Show>

        <ConversionSetup
          plugin={props.plugin}
          setup={setup}
          needsPdf={needsPdf()}
          chinesePdf={quickPdf()}
          onChange={() => void checkPdf()}
        />

        <Show when={allHidden() || !available().length}>
          <div class="ex-export-modal-warning" role="status">
            <Icon name="alert-triangle" />
            <span>{allHidden() ? t.EXPORT_DIALOG_NO_TEMPLATES : t.TEMPLATES_EMPTY}</span>
          </div>
        </Show>

        <Show when={dropped().length > 0}>
          <div class="ex-export-modal-warning">
            <Icon name="alert-triangle" />
            <span>{t.EXPORT_DIALOG_DROPPED(dropped().join(' '))}</span>
          </div>
        </Show>

        <Show when={available().length > 0}>
          <Section name="文件名、目录与样式" open={details()} onToggle={setDetails}>
            <Setting name={t.EXPORT_DIALOG_TEMPLATE}>
              <DropDown
                options={exportTypes()}
                selected={setting()?.name}
                onChange={selectTemplate}
                autofocus={false}
                tooltip={t.EXPORT_DIALOG_TEMPLATE}
              />
            </Setting>
            <Setting
              name={t.EXPORT_DIALOG_FILE_NAME}
              description={invalidName() ? '文件名含有系统不允许的字符。' : t.EXPORT_DIALOG_FILE_NAME_DESC(extension())}
            >
              <Text tooltip={t.EXPORT_DIALOG_FILE_NAME} value={candidateOutputFileName()} onChange={setCandidateOutputFileName} />
            </Setting>
            <Setting name={t.EXPORT_DIALOG_LOCATION} class={isMobileUi() ? 'ex-export-modal-folder' : undefined}>
              <Show
                when={isMobileUi()}
                fallback={
                  <Button tooltip={candidateOutputDirectory()} onClick={() => void chooseFolder()}>
                    {t.CHOOSE_FOLDER}
                  </Button>
                }
              >
                <FolderInput app={app} value={vaultFolder()} placeholder={t.IMPORT_DIALOG_FOLDER_PLACEHOLDER} onChange={setVaultFolder} />
              </Show>
            </Setting>
            <Show when={supportsToc(format())}>
              <Setting name={t.TOC} description={t.TOC_DESC} class="ex-export-modal-toc">
                <StepSlider labels={tocLabels} min={TOC_NONE} value={toc()} onChange={setTocOverride} />
              </Setting>
            </Show>
            <Show when={format() === 'docx'}>
              <Setting name={t.REFERENCE_DOC} description={activeReference() ? basename(activeReference()) : t.REFERENCE_DOC_DESC}>
                <Show
                  when={isMobileUi()}
                  fallback={
                    <Button onClick={() => void chooseFile({ filters: JOIN_FILES }).then(path => path && setReference(path))}>
                      选择样式文件
                    </Button>
                  }
                >
                  <VaultFileInput
                    app={app}
                    value={activeReference().startsWith(vaultDir + '/') ? activeReference().slice(vaultDir.length + 1) : ''}
                    extensions={['docx', 'dotx']}
                    placeholder="选择库内 Word 文件"
                    onChange={path => setReference(path ? fullPath(app.vault.adapter, path) : undefined)}
                  />
                </Show>
                <Show when={reference() !== undefined}>
                  <Button onClick={() => setReference(undefined)}>恢复模板设置</Button>
                </Show>
              </Setting>
              <For each={JOIN_SIDES}>
                {side => (
                  <DocumentList
                    app={app}
                    name={side === 'before' ? t.JOIN_BEFORE : t.JOIN_AFTER}
                    value={joinValue(side)}
                    filters={JOIN_FILES}
                    onChange={value => chooseJoin(side, value)}
                  />
                )}
              </For>
            </Show>
            <Setting name={t.EXPORT_DIALOG_OVERWRITE} class="mod-toggle">
              <Toggle checked={showOverwriteConfirmation()} onChange={setShowOverwriteConfirmation} />
            </Setting>
          </Section>
        </Show>

        <div class="modal-button-container">
          <Button cta disabled={!canExport()} onClick={() => void doExport()}>
            {dropped().length > 0 ? t.EXPORT_DIALOG_SUBMIT_ANYWAY : t.EXPORT_DIALOG_SUBMIT}
          </Button>
        </div>
      </Modal>
    </>
  );
};

const show = (plugin: PandocGuiPlugin, currentFile: TFile) =>
  createRoot(dispose => {
    let disposed = false;
    const cleanup = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      dispose();
    };
    // `insert` returns anything solid can render; the guard below establishes it is a node.
    const el = insert(document.body, () => <Dialog onClose={cleanup} plugin={plugin} currentFile={currentFile} />) as Node;
    onCleanup(() => {
      if (el?.instanceOf(Node) && document.body.contains(el)) {
        document.body.removeChild(el);
      }
    });
    return cleanup;
  });

export default {
  show,
};
