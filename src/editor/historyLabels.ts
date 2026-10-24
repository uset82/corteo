// Human labels for undo-history steps.
//
// The undo stack is snapshot-based: `History.past` holds whole ProjectDocs and
// carries no record of what produced them. To show a readable history panel we
// have to name each step as it is pushed, which is what `actionLabel` does.
//
// Labels are i18n KEYS written in Chinese, like every other string in the UI
// (see src/i18n/locale.ts) — the dictionaries translate them.
/**
 * Anything the label map can describe. Structural rather than the concrete
 * `AnyAction` union so history-control actions (undo/redo/gesture boundaries)
 * can be passed too — they simply have no label and never push a step.
 */
export interface LabelableAction {
  type: string;
  actions?: readonly LabelableAction[];
}

/**
 * Action type → i18n key. Types absent here are either non-mutating
 * (select, tl.switch, undo/redo) or fall back to a generic label, so a new
 * action type degrades to "编辑" instead of breaking the panel.
 */
const ACTION_LABELS: Record<string, string> = {
  add: '添加片段',
  addAsset: '导入素材',
  addMarker: '添加标记',
  addTransition: '添加转场',
  cleanScript: '清理文字稿',
  clear: '清空',
  clearEdits: '清除文字稿编辑',
  clearKeyframes: '清除关键帧',
  deleteWords: '删除词',
  duplicate: '复制片段',
  fixTranscriptWord: '修正文字稿',
  move: '移动片段',
  reframeKeyframe: '添加重构图关键帧',
  relinkTimelineItem: '重新链接素材',
  remove: '删除片段',
  removeKeyframe: '删除关键帧',
  removeMarker: '删除标记',
  removeReframeKeyframe: '删除重构图关键帧',
  removeTransition: '删除转场',
  renameSpeaker: '重命名说话人',
  reorderTrackItems: '调整片段顺序',
  replaceMedia: '替换素材',
  retime: '调整时长',
  setBackgroundFill: '调整背景填充',
  setCanvas: '修改画布',
  setCaptions: '修改字幕',
  setCaptionsHidden: '显示/隐藏字幕',
  setEffects: '应用效果',
  setFade: '调整淡入淡出',
  setFilters: '调整调色',
  setFullState: '替换时间线',
  setGapCap: '调整停顿压缩',
  setItemDenoise: '人声分离',
  setItemTranscript: '修改文字稿',
  setItemVariants: '修改文字稿版本',
  setKeyframe: '添加关键帧',
  setSpeed: '调整速度',
  setTranscriptPlayOrder: '调整文字稿顺序',
  setTransform: '调整变换',
  setTransition: '修改转场',
  setVolume: '调整音量',
  setZoom: '调整缩放',
  slip: '滑移素材',
  split: '分割片段',
  'tl.create': '新建序列',
  'tl.delete': '删除序列',
  'tl.duplicate': '复制序列',
  'tl.rename': '重命名序列',
  'tl.retarget': '切换序列素材',
  'tl.setDoc': '替换项目',
  'tl.setFps': '修改帧率',
  'tl.setHidden': '显示/隐藏序列',
  toggleTrack: '切换轨道开关',
  toggleWord: '编辑词',
  'track.create': '新建轨道',
  'track.delete': '删除轨道',
  'track.tighten': '收紧轨道',
  'track.update': '修改轨道',
  updateCaptions: '修改字幕',
  updateMarker: '修改标记',
  updateProps: '修改属性',
  updateWatermark: '修改水印',
  'design.set': '应用设计风格',
  'design.patch': '修改设计风格',
  'pool.canonicalizeAsset': '整理素材',
  'pool.createFolder': '新建素材文件夹',
  'pool.deleteFolder': '删除素材文件夹',
  'pool.moveAssets': '移动素材',
  'pool.relinkAsset': '重新链接素材',
  'pool.removeAsset': '移除素材',
  'pool.renameFolder': '重命名素材文件夹',
  'pool.setTranscription': '修改素材文字稿',
  'pool.updateAsset': '修改素材',
};

/** Shown when a mutating action has no specific label. */
export const GENERIC_HISTORY_LABEL = '编辑';

/** The step a batch should be named after: its first labelled sub-action. */
function batchLabel(action: LabelableAction): string {
  for (const entry of action.actions ?? []) {
    const label = actionLabel(entry);
    if (label) return label;
  }
  return GENERIC_HISTORY_LABEL;
}

/**
 * i18n key describing one history step, or undefined when the action must not
 * produce a step at all (navigation, selection, undo/redo themselves).
 * `historyReduce` only consults this when it is about to push a snapshot.
 */
export function actionLabel(action: LabelableAction): string | undefined {
  if (action.type === 'batch') return batchLabel(action);
  if (action.type === 'undo' || action.type === 'redo') return undefined;
  if (action.type === 'history.beginGesture' || action.type === 'history.endGesture') return undefined;
  if (action.type === 'select' || action.type === 'selectAll' || action.type === 'selectMany') return undefined;
  if (action.type === 'tl.switch') return undefined;
  return ACTION_LABELS[action.type] ?? GENERIC_HISTORY_LABEL;
}

// ── history panel view model ──────────────────────────────────────────────

/** Undo stack as the panel consumes it (labels are i18n keys). */
export interface HistorySteps {
  /** Label of each past step, oldest first ('' for the opening state). */
  past: string[];
  /** Label of the step that produced the current state. */
  present?: string;
  /** Label of each redoable step, next redo first. */
  future: string[];
}

/** One rendered row of the history panel. */
export interface HistoryRow {
  key: string;
  /** i18n key; '' means the opening state. */
  label: string;
  state: 'past' | 'present' | 'future';
  /** Undo (negative) or redo (positive) count to reach this row; 0 = current. */
  distance: number;
}

/**
 * Flatten the stack into one linear list, oldest first: every past state, the
 * current one, then everything redoable. A row's `distance` is how many undo
 * or redo dispatches land on it, which is what makes the panel clickable.
 */
export function historyRows(steps: HistorySteps): HistoryRow[] {
  const rows: HistoryRow[] = steps.past.map((label, index) => ({
    key: `past-${index}`,
    label,
    state: 'past' as const,
    distance: -(steps.past.length - index),
  }));
  rows.push({ key: 'present', label: steps.present ?? '', state: 'present', distance: 0 });
  steps.future.forEach((label, index) => {
    rows.push({ key: `future-${index}`, label, state: 'future', distance: index + 1 });
  });
  return rows;
}
