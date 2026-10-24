// The chat panel's four starters and four quick actions (Plan 4, BQ-3).
// Text only, and the musician's words: montar, cortar, letra, golpes, plano.
// There is no `icon` field on purpose — the rows carry no icon tiles.
interface ProjectStarter {
  readonly label: string;
  readonly description: string;
  readonly prompt: string;
}

interface QuickAction {
  readonly label: string;
  readonly prompt: string;
}

export const EMPTY_PROJECT_STARTERS: readonly ProjectStarter[] = [
  { label: '按节拍剪辑', description: '在歌曲的鼓点上切换镜头', prompt: '按歌曲的鼓点切换镜头，做出有节奏的剪辑' },
  { label: '歌词上屏', description: '与歌声同步的歌词字幕', prompt: '生成与歌声同步的歌词字幕并应用到时间线' },
  { label: '竖版预告', description: '9:16 的 15 秒高光片段', prompt: '挑出最精彩的部分，做一支 9:16 的 15 秒竖版预告' },
  { label: '片头与片尾字幕', description: '开场标题与结尾字幕', prompt: '为这支片子做开场标题和结尾字幕' },
];

export const QUICK_ACTIONS: readonly QuickAction[] = [
  { label: '在鼓点上切分', prompt: '在当前时间线的鼓点位置切分片段' },
  { label: '添加歌词', prompt: '为当前片段添加歌词字幕' },
  { label: '转为竖屏', prompt: '把当前工程转换为 9:16 竖屏，并调整主要画面构图' },
  { label: '裁掉首尾', prompt: '裁掉当前片段开头和结尾的多余部分' },
];
