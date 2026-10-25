// English copy for the corteo brand work (Plan 4). Its own file so the BD track
// never edits the per-module dictionaries and never collides with the BQ track.
// Assembled last in ./index.ts, so a key here wins over a stale entry elsewhere.
export default {
  // Projects page (BD-4)
  '配置模型后即可使用助手。': 'Set up a model to use the assistant.',
  '还没有工程': 'No projects yet',
  '新建一个工程，或导入一个 .ccproj 文件。': 'Create a new project or import a .ccproj file.',
  // Fork links (BQ-2)
  '源代码 (AGPL)': 'Source code (AGPL)',
  // Chat panel (BQ-3)
  '编辑助手': 'Editing assistant',
  '你想剪什么？': 'What do you want to cut?',
  '描述你想要的视频，或从下面挑一个开始。': 'Describe the video you want, or start from one of these ideas.',
  // Chat starters and quick actions (BQ-3)
  '按节拍剪辑': 'Cut to the beat',
  '在歌曲的鼓点上切换镜头': 'Change shots on the hits',
  '按歌曲的鼓点切换镜头，做出有节奏的剪辑': 'Cut the shots on the hits and give the edit a rhythm',
  '歌词上屏': 'Lyrics on screen',
  '与歌声同步的歌词字幕': 'Lyric subtitles synced to the vocal',
  '生成与歌声同步的歌词字幕并应用到时间线': 'Generate lyric subtitles synced to the vocal and apply them to the timeline',
  '竖版预告': 'Vertical teaser',
  '9:16 的 15 秒高光片段': '15 seconds in 9:16 with the best moment',
  '挑出最精彩的部分，做一支 9:16 的 15 秒竖版预告': 'Pick the best moment and make a 15-second 9:16 teaser',
  '片头与片尾字幕': 'Titles and credits',
  '开场标题与结尾字幕': 'Opening title and closing credits',
  '为这支片子做开场标题和结尾字幕': 'Add an opening title and closing credits to this piece',
  '在鼓点上切分': 'Cut on the hits',
  '在当前时间线的鼓点位置切分片段': 'Split the clips on the hits in the current timeline',
  '添加歌词': 'Add the lyrics',
  '为当前片段添加歌词字幕': 'Add lyric subtitles to the current clips',
  '转为竖屏': 'Go vertical',
  '把当前工程转换为 9:16 竖屏，并调整主要画面构图': 'Turn the project into 9:16 and reframe the main shot',
  '裁掉首尾': 'Trim head and tail',
  '裁掉当前片段开头和结尾的多余部分': 'Trim the extra material at the start and end of the current clips',
} as Record<string, string>;
