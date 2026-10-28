// Spanish copy for the zoom-shape and transition labels in src/editor/types.ts
// (P5-1). Keys stay the Chinese originals; values match es/components.ts where
// the same label is already translated there.
export default {
  // ZOOM_SHAPE_LABELS
  '冲击': 'Impacto',
  '推进拉回': 'Acercar y retroceder',
  '慢推': 'Acercamiento lento',
  '瞬时': 'Instantáneo',
  '缓入推近': 'Acercamiento con entrada suave',
  '弹性推近': 'Acercamiento elástico',
  '快切推近': 'Acercamiento seco',
  '心跳脉冲': 'Pulso',
  '甩入推近': 'Acercamiento con latigazo',
  // TRANSITION_LABELS
  '推进转场': 'Zoom de anticipación',
  '白色划线转场': 'Barrido de línea blanca',
  '叠化转场': 'Fundido cruzado',
  '闪黑转场': 'Fundido a negro',
  '闪白转场': 'Destello',
  '冲击抖动转场': 'Sacudida de impacto',
  '叠加转场': 'Mezcla de luminancia',
  '光溶转场': 'Disolvencia orgánica',
  '翻页转场': 'Pasar página',
  '焦点转场': 'Cambio de foco',
  '柔化擦除转场': 'Barrido suave',
  '甩镜转场': 'Latigazo de cámara',
  '圆形擦除转场': 'Barrido circular',
  // Failure copy
  '人声分离失败，未修改任何片段。': 'No se pudo aislar la voz; no se modificó ningún clip.',
  '响度分析失败，未修改任何片段。': 'No se pudo analizar el volumen; no se modificó ningún clip.',
  '所选片段的源素材已变化，旧的人声分离结果已丢弃。请重试。': 'El medio de origen de los clips seleccionados ha cambiado, así que se descartó el resultado anterior de separación de voz. Vuelve a intentarlo.',
} as Record<string, string>;
