import en from './en';
import zh from './zh';
import userGuideZh from '../../docs/USER_GUIDE_ZH.md';
import changelogZh from '../../docs/CHANGELOG_ZH.md';

export type Lang = typeof en;

export const t: Lang = zh;
export const userGuide = (): string => userGuideZh;
export const changelog = (): string => changelogZh;
