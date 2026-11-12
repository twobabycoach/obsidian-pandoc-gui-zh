const names: Record<string, string> = {
  Markdown: '通用 Markdown',
  'Markdown (GFM)': 'GitHub 兼容 Markdown',
  'Markdown (Hugo)': 'Hugo 博客 Markdown',
  Html: '网页（HTML）',
  Typst: 'Typst 源文件',
  PDF: 'PDF（LaTeX 排版）',
  'PDF (Typst)': 'PDF（内置排版）',
  'Beamer slides (.pdf)': 'Beamer 幻灯片（PDF）',
  'Reveal.js slides (.html)': 'Reveal.js 网页幻灯片',
  'Word (.docx)': 'Word 文档（.docx）',
  OpenOffice: '开放文档（.odt）',
  'Flat OpenOffice (.fodt)': '开放文档 XML（.fodt）',
  RTF: '富文本（.rtf）',
  Epub: '电子书（EPUB）',
  Latex: 'LaTeX 源文件',
  'LaTeX fragment (.tex)': 'LaTeX 正文片段',
  'Media Wiki': '维基页面（MediaWiki）',
  'Plain text (.txt)': '纯文本（.txt）',
  'Bibliography (.bib)': '参考文献库（BibTeX）',
  'PowerPoint (.pptx)': 'PowerPoint 幻灯片（.pptx）',
  Custom: '自定义命令（技术选项）',
};

export const formatLabel = (preset: string): string => names[preset] ?? preset;

/** Translate the display name without changing the name stored in an existing vault. */
export const templateLabel = (name: string, preset = name): string => {
  const suffix = name.slice(preset.length);
  return name === preset || (name.startsWith(preset) && /^ \d+$/.test(suffix)) ? formatLabel(preset) + suffix : name;
};
