// Spanish copy for the Claudia brand work (Plan 4). dictRegistry spreads this over
// es/index.ts, so the BD track never edits that file: sentence case, "tú", plain
// verbs — "Nuevo proyecto", not "Nuevo Proyecto".
export default {
  // Projects page (BD-4)
  '工程': 'Proyectos',
  '新建工程': 'Nuevo proyecto',
  '导入工程': 'Importar proyecto',
  '搜索工程': 'Buscar proyectos',
  '清除搜索': 'Limpiar búsqueda',
  '清理素材': 'Limpiar medios',
  '配置模型': 'Configurar modelo',
  '{n} 个': '{n}',
  '{n} / {total} 个': '{n} de {total}',
  '配置模型后即可使用助手。': 'Configura un modelo para usar el asistente.',
  '还没有工程': 'Todavía no hay proyectos',
  '新建一个工程，或导入一个 .ccproj 文件。': 'Crea un proyecto nuevo o importa un archivo .ccproj.',
  // Was missing from es/index.ts: Spanish users saw the English fallback.
  '没有找到匹配“{query}”的工程': 'No hay proyectos que coincidan con “{query}”',
  // Fork links (BQ-2)
  '源代码 (AGPL)': 'Código fuente (AGPL)',
  // Chat panel labels (BQ-1)
  '展开助手': 'Mostrar asistente',
  '收起助手': 'Ocultar asistente',
  // Chat panel (BQ-3)
  '编辑助手': 'Asistente de edición',
  '你想剪什么？': '¿Qué quieres montar?',
  '描述你想要的视频，或从下面挑一个开始。': 'Describe el vídeo que quieres o empieza por una de estas ideas.',
  // Top bar (BQ-4): sentence case
  '返回工程列表': 'Volver a proyectos',
  // Chat starters and quick actions (BQ-3)
  '按节拍剪辑': 'Montar al ritmo',
  '在歌曲的鼓点上切换镜头': 'Cambia de plano en los golpes de la canción',
  '按歌曲的鼓点切换镜头，做出有节奏的剪辑': 'Monta los planos en los golpes de la canción y dale ritmo al corte',
  '歌词上屏': 'Letra en pantalla',
  '与歌声同步的歌词字幕': 'Subtítulos de la letra sincronizados con la voz',
  '生成与歌声同步的歌词字幕并应用到时间线': 'Genera los subtítulos de la letra sincronizados con la voz y aplícalos a la línea de tiempo',
  '竖版预告': 'Teaser vertical',
  '9:16 的 15 秒高光片段': '15 segundos en 9:16 con el mejor momento',
  '挑出最精彩的部分，做一支 9:16 的 15 秒竖版预告': 'Elige el mejor momento y monta un teaser vertical de 15 segundos en 9:16',
  '片头与片尾字幕': 'Títulos y créditos',
  '开场标题与结尾字幕': 'Título de apertura y créditos finales',
  '为这支片子做开场标题和结尾字幕': 'Pon un título de apertura y créditos finales a esta pieza',
  '在鼓点上切分': 'Cortar en los golpes',
  '在当前时间线的鼓点位置切分片段': 'Corta los clips en los golpes de la línea de tiempo actual',
  '添加歌词': 'Añadir la letra',
  '为当前片段添加歌词字幕': 'Añade los subtítulos de la letra a los clips actuales',
  '转为竖屏': 'Pasar a vertical',
  '把当前工程转换为 9:16 竖屏，并调整主要画面构图': 'Pasa el proyecto a 9:16 y reencuadra el plano principal',
  '裁掉首尾': 'Recortar inicio y final',
  '裁掉当前片段开头和结尾的多余部分': 'Recorta lo que sobra al principio y al final de los clips actuales',
  // Chat panel strings that only had an English fallback (BQ-3)
  '清空对话': 'Vaciar la conversación',
  '加载更早消息': 'Cargar mensajes anteriores',
  '聊天滚动快捷操作': 'Atajos de desplazamiento del chat',
  '快速操作': 'Acciones rápidas',
  '快速操作…': 'Acciones rápidas…',
  '描述你想要创建的内容...': 'Describe lo que quieres crear…',
  '告诉 AI 要做哪些修改 - @ 引用素材': 'Dime qué cambiar. Usa @ para citar un medio.',
  '以下能力未配置，相关功能暂不可用：': 'Estas capacidades no están configuradas y no están disponibles:',
  '去设置配置': 'Ir a ajustes',
} as Record<string, string>;
