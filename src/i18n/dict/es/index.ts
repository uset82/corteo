// Spanish UI assembly. Chinese text is the key, Spanish is the value.
// Per-module files mirror src/i18n/dict/en/ (P5-1); `base` holds the entries that
// predate them and is spread last, so no wording translated before P5-1 changes.
// dictRegistry.ts spreads es/brand.ts over this default export.
import chat from './chat';
import components from './components';
import editor from './editor';
import exportPanel from './exportPanel';
import media from './media';
import review from './review';
import timeline from './timeline';
import topbar from './topbar';

const base: Record<string, string> = {
  '歌曲地图标题': 'Mapa de la canción',
  '歌曲地图返回': 'Volver',
  '歌曲地图调性': 'Tonalidad',
  '歌曲地图小调': 'menor',
  '歌曲地图大调': 'mayor',
  '歌曲地图歌词': 'Letra',
  '歌曲地图已听': 'Escuchado de verdad',
  '歌曲地图未验证': 'Sin verificar',
  // Music analysis metrics, shown by the song badge and the song-map dialog
  '速度': 'Tempo',
  '拍号': 'Compás',
  '能量': 'Energía',
  '音乐地图显示': 'Mapa musical',
  '音乐反应标题': 'Reaccionar a la música',
  '音乐反应脉冲': 'Pulso',
  '音乐反应冲击': 'Golpe',
  '音乐反应震动': 'Temblor',
  '音乐反应闪光': 'Destello',
  '音乐反应呼吸': 'Respirar',
  '音乐节奏 Ken Burns': 'Ken Burns al ritmo',
  '音乐反应时机': 'Momento',
  '音乐时机节拍': 'Pulsos',
  '音乐时机小节': 'Compases',
  '音乐时机重音': 'Acentos',
  '音乐时机高潮': 'Caídas',
  '音乐时机段落': 'Secciones',
  '音乐时机能量': 'Energía',
  '音乐反应强度': 'Intensidad',
  '音乐反应应用': 'Aplicar',
  '音乐反应移除': 'Quitar',
  '音乐反应能量': 'Energía musical',
  '时间线没有歌曲': 'No hay canción en la línea de tiempo',
  '请先分析歌曲媒体徽章': 'Analiza la canción primero (insignia de la canción en Medios)',
  '音乐反应完成': 'Reacción musical actualizada.',
  '音乐反应未更改': 'No se cambió ninguna reacción. Revisa la canción, el momento y las pistas bloqueadas.',
  // Dashboard
  '· 我的工程': '· Mis Proyectos',
  '工程': 'Proyectos',
  '新建工程': 'Nuevo Proyecto',
  '导入工程': 'Importar Proyecto',
  '导入 .ccproj 工程文件(兼容旧 .ccproj.json)': 'Importar archivo de proyecto .ccproj (compatible con .ccproj.json antiguo)',
  '导出为流式 .ccproj(含素材,可在桌面版/其它机器导入)': 'Exportar como .ccproj (con medios, importable en escritorio u otros equipos)',
  '搜索工程': 'Buscar Proyectos',
  '清除搜索': 'Limpiar Búsqueda',
  '清理素材': 'Limpiar Medios',
  '清理所有工程都不引用的上传素材(测试/已删工程残留)': 'Limpiar medios no referenciados (pruebas/proyectos eliminados)',
  '打开 {name}': 'Abrir {name}',
  '重命名': 'Renombrar',
  '双击重命名': 'Doble clic para renombrar',
  '复制': 'Copiar',
  '删除': 'Eliminar',
  '确认删除': 'Confirmar Eliminación',
  '彻底删除工程,并清掉只有它引用的素材文件': 'Eliminar proyecto permanentemente y limpiar sus archivos de medios',
  '{n} 个': '{n} elementos',
  '{n} / {total} 个': '{n} / {total} elementos',
  '已永久删除「{name}」': 'Eliminado permanentemente «{name}»',
  
  // Model setup
  '配置模型后开始使用 Agent': 'Configurar modelos para usar Agent',
  '配置任一云端或本地模型，即可在编辑器中使用对话式剪辑。': 'Configure un modelo en la nube o local para usar edición conversacional.',
  '配置模型': 'Configurar Modelo',
  
  // Settings
  '设置 · API 密钥': 'Configuración · Claves API',
  '外部 Agent 接入 (MCP)': 'Conexión Agent Externa (MCP)',
  '连接一个 bot': 'Conectar un bot',
  '一次安装，之后它自己驱动 corteo。': 'Una instalación y luego lo maneja solo.',
  'MCP 地址': 'URL del MCP',
  '复制地址': 'Copiar URL',
  '复制命令': 'Copiar comando',
  '令牌文件': 'Archivo del token',
  '机器人读这个文件，不要把内容贴进对话。': 'El bot lee este archivo; no pegues su contenido en el chat.',
  '安装命令': 'Comando de instalación',
  '把下面的片段交给 bot；它只带环境变量名，没有令牌。': 'Dale el fragmento de abajo al bot; lleva nombres de variables de entorno, no el token.',
  '导出与取帧工具需要一个已注册的编辑器标签页：在终端运行 npm run editor-host。': 'Las herramientas de exportación y de fotogramas necesitan una pestaña del editor registrada: ejecuta npm run editor-host en una terminal.',
  '编辑快捷键': 'Editar Atajos de Teclado',
  
  // Loading states
  '加载工程…': 'Cargando proyecto…',
  '加载编辑器…': 'Cargando editor…',
  '工程不存在，返回…': 'El proyecto no existe, regresando…',
  '工程数据暂时无法读取': 'Los datos del proyecto no se pueden leer temporalmente',
  '为避免覆盖已保存的内容，已停止打开该工程。数据仍保留在本机存储中，可稍后重试。': 'Para evitar sobrescribir contenido guardado, se detuvo la apertura del proyecto. Los datos permanecen en almacenamiento local, intente más tarde.',
  '重试': 'Reintentar',
  '返回工程列表': 'Regresar a la Lista de Proyectos',
  '示例工程': 'Proyecto de Ejemplo',
  
  // Top bar
  '文件': 'Archivo',
  '编辑': 'Editar',
  '查看': 'Ver',
  '项目': 'Proyecto',
  '导出': 'Exportar',
  '设置': 'Configuración',
  
  // Timeline
  '时间轴': 'Línea de Tiempo',
  '视频': 'Video',
  '音频': 'Audio',
  '字幕': 'Subtítulos',
  '轨道': 'Pista',
  
  // Tools
  '工具': 'Herramientas',
  '选择': 'Seleccionar',
  '剪切': 'Cortar',
  '粘贴': 'Pegar',
  
  // Effects
  '效果': 'Efectos',
  '转场': 'Transiciones',
  
  // Inspector
  '属性': 'Propiedades',
  '片段属性': 'Propiedades del Fragmento',
  '字幕属性': 'Propiedades de Subtítulo',
  '{n} 个片段': '{n} fragmentos',
  '展开属性': 'Expandir Propiedades',
  '收起属性': 'Contraer Propiedades',
  '选中时间线上的片段以编辑属性。': 'Seleccione un fragmento en la línea de tiempo para editar propiedades.',
  '位置': 'Posición',
  '缩放': 'Escala',
  '旋转': 'Rotación',
  '不透明度': 'Opacidad',
  '人声隔离': 'Aislamiento Vocal',
  
  // Playback
  '播放': 'Reproducir',
  '暂停': 'Pausar',
  '停止': 'Detener',
  
  // Common
  '确定': 'Aceptar',
  '取消': 'Cancelar',
  '应用': 'Aplicar',
  '撤销': 'Deshacer',
  '重做': 'Rehacer',
  '关闭': 'Cerrar',
  '保存': 'Guardar',
  
  // Library
  '媒体库': 'Biblioteca de Medios',
  '导入': 'Importar',
  
  // Export
  '渲染': 'Renderizar',
  '质量': 'Calidad',
  '分辨率': 'Resolución',
  '编码器': 'Códec',
  
  // Ken Burns
  'Ken Burns 效果': 'Efecto Ken Burns',
  '开始位置': 'Posición Inicial',
  '结束位置': 'Posición Final',
  '开始缩放': 'Escala Inicial',
  '结束缩放': 'Escala Final',
  '缓动': 'Suavizado',
  '自动': 'Automático',
  '推近': 'Acercar',
  '拉远': 'Alejar',
  '左移': 'Mover a la izquierda',
  '右移': 'Mover a la derecha',
  '上移': 'Mover arriba',
  '下移': 'Mover abajo',
  
  // Karaoke
  '卡拉OK': 'Karaoke',
  '歌词对齐': 'Alineación de Letras',
  
  // Time
  '已用时间': 'Tiempo Transcurrido',
  '剩余时间': 'Tiempo Restante',
  '持续时间': 'Duración',
  
  // Duplicate Detection
  '重复片段检测': 'Detección de Fragmentos Duplicados',
  '扫描': 'Escanear',
  '未找到重复': 'No se encontraron duplicados',
  
  // Enhanced Export
  '高级导出': 'Exportación Avanzada',
  '视频编码': 'Códec de Video',
  '音频编码': 'Códec de Audio',
  '比特率': 'Tasa de Bits',

  // DeepSeek Harness
  'DeepSeek Harness 本地网关：先在终端运行 npm run harness 启动，再运行 npm run harness:doctor 获取网关地址与密钥；把地址和密钥粘贴到下面两项后点“测试并读取模型”。':
    'Gateway local de DeepSeek Harness: inicia el harness en una terminal con npm run harness y luego ejecuta npm run harness:doctor para obtener la dirección y la clave del gateway. Pégalas en los dos campos de abajo y pulsa «Probar y cargar modelos».',
  '尚未填写 API Key · 填好后再点测试': 'Aún no hay API Key · complétala y vuelve a probar',
  '连接成功 · 鉴权通过 · 已读取 {n} 个模型 · {ms}ms': 'Conexión correcta · clave aceptada · {n} modelos leídos · {ms} ms',
  '连接成功 · 鉴权通过 · 接口未返回模型列表 · {ms}ms': 'Conexión correcta · clave aceptada · la interfaz no devolvió una lista de modelos · {ms} ms',
  '连接成功 · 鉴权通过 · {ms}ms': 'Conexión correcta · clave aceptada · {ms} ms',
  '鉴权失败（HTTP {status}）· Key 无效、过期或无此接口权限': 'Autenticación fallida (HTTP {status}) · la clave no es válida, caducó o no tiene permiso para esta interfaz',
  '探测端点 404 · Base URL 可能填错（或该服务不认此探测路径）': 'El endpoint de prueba devolvió 404 · la Base URL puede estar mal (o el servicio no usa esta ruta de prueba)',
  '鉴权通过（HTTP 429 限流，说明 Key 有效）': 'Clave aceptada (el límite HTTP 429 confirma que es válida)',
  'HTTP {status}': 'HTTP {status}',
  'HTTP {status} · {detail}': 'HTTP {status} · {detail}',
  '连接超时 · 服务不可达或网络受限（可能需代理），不代表 Key 错误': 'Tiempo de conexión agotado · servicio inaccesible o red restringida (puede requerir proxy); no significa que la clave sea incorrecta',
  '网络不可达 · {detail} · 本机连不上该服务（可能需代理），不代表 Key 错误': 'Red inaccesible · {detail} · este equipo no puede alcanzar el servicio (puede requerir proxy); no significa que la clave sea incorrecta',

  // DeepSeek Harness · modelo del compositor
  '请先在设置中配置一个模型厂商。': '1. Inicia el harness: npm run harness\n2. Obtén la URL y la clave del gateway: npm run harness:doctor\n3. Pégalas en Ajustes › DeepSeek Harness.',
  '刷新模型列表': 'Actualizar lista de modelos',
  'DeepSeek Harness 无响应。用 npm run harness 启动它。': 'DeepSeek Harness no responde. Arráncalo con npm run harness.',

  // Plan 5 · panel «Analizar episodio»
  '分析长视频': 'Analizar episodio',
  '从长视频里挑出值得发布的片段': 'Encuentra los momentos que merece la pena publicar',
  '分析': 'Analizar',
  '分析中…': 'Analizando…',
  '潜力': 'Potencial',
  '钩子': 'Gancho',
  '流畅': 'Flujo',
  '价值': 'Valor',
  '声音': 'Sonido',
  '创建所选片段': 'Crear clips seleccionados',
  '批准': 'Aprobar',
  '丢弃': 'Descartar',
  '选择片段': 'Elegir clip',
  '没有找到合适的片段。': 'Ningún momento llegó al mínimo.',
  '还没有分析结果。': 'Todavía no hay resultados.',
  '已创建 {n} 个片段': 'Creados {n} clips',
  '已批准，评分会记住这个选择': 'Aprobado: la puntuación recordará esta elección',
  '已丢弃，评分会避开这一类': 'Descartado: la puntuación evitará este tipo de momento',
  '评分是参考，不是预测': 'La puntuación es orientativa, no una predicción',

  // Plan 5 · sección «Marca» del panel de estilo
  '品牌': 'Marca',
  '品牌名称': 'Nombre de la marca',
  '字幕样式': 'Estilo de subtítulos',
  '安全边距': 'Margen seguro',
  '保存品牌': 'Guardar marca',
  '已保存': 'Guardado',
  'corteo puede aplicar esta marca a todos los clips': 'corteo puede aplicar esta marca a todos los clips',

  // Plan 2 · L-10, latido de subtítulos sobre los pulsos de la canción
  '音乐脉动': 'Latido musical',
  '正在读取节拍…': 'Leyendo los pulsos…',
  '节拍脉动 · {n} 拍': 'Latido · {n} pulsos',
  '音乐脉动需要先分析歌曲。': 'El latido necesita el análisis de la canción.',

  // Plan 5 · calendario «Programar»
  'Programar publicaciones': 'Programar publicaciones',
  'Nada programado': 'Nada programado',
  'Actualizar': 'Actualizar',
  'Actualizando…': 'Actualizando…',
  'Cancelar': 'Cancelar',
  'No se pudo leer la cola de publicaciones.': 'No se pudo leer la cola de publicaciones.',
  'Alguna publicación falló: revisa el estado antes de volver a programarla.': 'Alguna publicación falló: revisa el estado antes de volver a programarla.',
  'planned': 'programada',
  'running': 'publicando',
  'published': 'publicada',
  'failed': 'falló',
  '连接 corteo': 'Conectar corteo',
  '把下面的配置交给 corteo。她从这台电脑以外编辑这个工程。编辑器的域名必须写进 hosting.egressDomains。':
    'Dale a corteo la configuración de abajo para que edite este proyecto desde fuera de este PC. El dominio del editor tiene que estar en hosting.egressDomains.',
};

export default Object.assign({}, chat, components, editor, exportPanel, media, review, timeline, topbar, base) as Record<string, string>;
