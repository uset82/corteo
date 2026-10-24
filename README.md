# corteo

**El brazo de Claudia para editar videoclips.**

corteo es el editor de video de Claudia, la asistente de IA de Carlos. Es un fork de [OpenChatCut](https://github.com/0xsline/OpenChatCut) con una línea de tiempo al estilo de Premiere, corre en WSL en http://localhost:5199 y está pensado para que Claudia lo maneje por MCP.

## Qué es y por qué

[Claudia](https://claudia.gallery) es una popstar de IA abierta: un personaje que cualquiera puede usar. Para Carlos es además su asistente, un bot de Grok. Claudia puede pensar un videoclip y generar material con Grok, pero para editarlo necesita un brazo: eso es corteo.

El reparto es simple:

- **Claudia decide**: qué imagen acompaña cada verso, dónde entra el coro, cómo se mueve cada plano.
- **corteo ejecuta**: importa, corta, anima, subtitula y exporta en una línea de tiempo real, que Carlos puede revisar y retocar a mano.

El primer objetivo son los videoclips de Carlos, como el de «Perú», su canción de protesta.

## Estado

El estado de cada tarea está en [`docs/plans/PROGRESS.md`](docs/plans/PROGRESS.md), y los planes completos en [`docs/plans/01-editor-claudia.md`](docs/plans/01-editor-claudia.md) (el editor y la conexión con Claudia), [`docs/plans/02-claudia-escucha.md`](docs/plans/02-claudia-escucha.md) (Claudia escucha la canción) y [`docs/plans/03-deepseek-harness.md`](docs/plans/03-deepseek-harness.md) (modelos gratis para el chat del editor). Si este README y `PROGRESS.md` no coinciden, vale `PROGRESS.md`.

### Lo que funciona hoy

Todo viene de OpenChatCut:

- Línea de tiempo multipista con herramientas y atajos al estilo de Premiere (V, B, N, U, P, Q/W, I/O, J/K/L).
- Fotogramas clave con curvas de aceleración, que se ven igual en la vista previa y en el video exportado.
- 22 estilos de subtítulos con resaltado palabra por palabra, tipo karaoke.
- Transcripción local con Whisper.
- Exportación hasta 4K en H.264 y VP8, y en ProRes desde el servidor.
- Varias secuencias por proyecto, transiciones, efectos, LUTs, plantillas animadas y varias pistas de audio.
- Un servidor MCP con token y unas 120 herramientas de edición. Hoy lo pueden usar los clientes MCP que corren en el mismo PC (Codex, Claude Code, Qoder…).

Con dos salvedades:

- La interfaz arranca en español, pero solo unos 100 de sus 2.520 textos están traducidos; el resto sale en inglés.
- OpenChatCut trae su propio chat de IA y funciones de generación, que piden claves de API. Siguen ahí. El plan apaga la generación y los modelos de pago; el chat se queda, pero solo con modelos gratis a través de DeepSeek Harness, o con Ollama y LM Studio en tu PC.

### Lo que falta

| Qué | Tareas |
|---|---|
| Que el servidor tenga memoria suficiente sin `NODE_OPTIONS` | P0-2 |
| Conectar a Claudia desde fuera de tu PC: `npm run start:claudia`, token fijo, túnel, tarjeta «Conectar Claudia» y una pestaña del editor sin pantalla para exportar por MCP | P0-3, P1-3 a P1-5 |
| Claudia en el chat del editor con modelos gratis a través de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) y el plugin [Our Free Model](https://github.com/Ebony-Vinyl/dsh-our-free-model), todos en el menú de modelos; el chat de DeepSeek Harness también podrá editar en corteo por MCP | HQ-1 a HQ-5, HW-1 a HW-5, H-9 |
| Apagar la generación de imágenes, voz, video y música dentro del editor; skill `videoclip-musical` para Claudia | P1-1, P1-2, P1-6 |
| «Claudia escucha la canción»: ritmo, secciones, emoción y coros, para que los efectos y movimientos sigan la música | L-01 a L-13 |
| Ken Burns, subtítulos de verso y coro, importar ASS/VTT, detector de tomas repetidas, exportación HEVC, cuenta regresiva, atajos de Premiere | P2-1 a P2-6 |
| Importar desde YouTube, Vimeo o Bilibili con sus créditos (yt-dlp) | P3-1 a P3-4 |
| Varias versiones de un videoclip y la vista «Comparar versiones» | P4-1 a P4-3 |
| Toda la interfaz en español | P5-1 a P5-3 |
| Prueba completa con Claudia, de la canción al video exportado | P6-1 |

Otros agentes hicieron una primera versión de varias funciones de P2 (Ken Burns, karaoke, duplicados, HEVC, cuenta regresiva) en una rama aparte. Tiene errores conocidos y está pendiente de revisión, así que no está en `main` y esas tareas siguen pendientes.

## Requisitos

- Windows 10 u 11 con WSL 2 y Ubuntu (en Linux funciona igual).
- Node.js 24, instalado con [nvm](https://github.com/nvm-sh/nvm). El repo trae `.nvmrc`, y `package.json` pide Node 24.
- Git (Ubuntu ya lo trae).
- Memoria: el servidor puede usar hasta 6 GB, así que conviene que WSL tenga 8 GB o más. WSL toma por defecto la mitad de la RAM de Windows; se cambia con `memory=` en `%UserProfile%\.wslconfig`.
- Chrome o Edge en Windows para abrir el editor.

ffmpeg no hace falta instalarlo: viene con las dependencias de npm. Tampoco hacen falta claves de API.

## Instalación

Una sola vez, en una terminal de WSL.

**1. nvm y Node 24**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
source ~/.bashrc
```

**2. corteo**

Clónalo dentro de Linux (`~/corteo`), no en `/mnt/c`: allí es mucho más lento.

```bash
git clone https://github.com/uset82/corteo.git ~/corteo
cd ~/corteo
nvm install            # lee .nvmrc e instala Node 24
nvm alias default 24   # para que cada terminal nueva use Node 24
npm install
```

En Linux, `npm install` también descarga un complemento CUDA de varios cientos de MB para ONNX Runtime. Si no tienes GPU NVIDIA, puedes saltártelo con `ONNXRUNTIME_NODE_INSTALL=skip npm install`.

**3. Librerías para el Chromium de las exportaciones**

Las exportaciones desde el servidor y los tests usan un Chromium sin pantalla, que necesita algunas librerías del sistema. El comando pide tu contraseña de WSL:

```bash
npx playwright install-deps chromium
```

No le pongas `sudo` delante: con nvm, `sudo` no encuentra `npx`, y el comando ya pide permisos por su cuenta.

## Uso

```bash
cd ~/corteo
NODE_OPTIONS=--max-old-space-size=6144 npm run dev
```

Abre **http://localhost:5199** en Chrome o Edge en Windows. Usa `localhost` y no la IP de WSL: el navegador solo activa las funciones de video que necesita el editor (WebCodecs, Web Crypto) en `localhost` o con HTTPS. Para parar el servidor, Ctrl+C en esa terminal.

`NODE_OPTIONS=--max-old-space-size=6144` le da al servidor 6 GB de memoria; sin eso se puede caer por falta de memoria. La tarea P0-2 lo hará automático.

### El alias `corteo`

Ejecuta esto una vez:

```bash
echo 'alias corteo="cd ~/corteo && VITE_CONFIG_NATIVE_IGNORE_WARNING=true NODE_OPTIONS=--max-old-space-size=6144 npm run dev"' >> ~/.bashrc
source ~/.bashrc
```

Desde entonces, escribir `corteo` en cualquier terminal de WSL arranca el editor. `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` solo oculta una lista larga de avisos inofensivos de Vite al arrancar.

### Tus datos

`npm run dev` guarda los proyectos, los medios importados, los ajustes y el token MCP en `~/.openchatcut/dev-profiles/<id>/`, una carpeta por cada copia del repo (la línea `[OpenChatCut] isolated profile <id>` del arranque dice cuál). Para hacer una copia de seguridad, copia `~/.openchatcut`.

### Conectar un cliente MCP

- Dirección: `http://localhost:5199/api/external-mcp/mcp`, con el encabezado `Authorization: Bearer <token>`.
- Token: en la pantalla de inicio, el botón de arriba a la derecha «Conexión Agent Externa (MCP)» (el nombre aparece al pasar el ratón), o el archivo `mcp-token` de la carpeta de tu perfil.

Hoy esto sirve para clientes que corren en el mismo PC. Claudia no corre en tu PC: para llegar al editor necesita un túnel (Cloudflare Tunnel o Tailscale Funnel), que el editor todavía no acepta, y la tarjeta «Conectar Claudia». Son las tareas P1-3 y P1-4.

## Sincronizar la rama de Cursor con GitHub

Esto es para el flujo de Carlos: el repo clonado desde Cursor con la CLI `origin`, con dos remotos.

- `origin`: la copia de Cursor. Los agentes de Cursor suben su trabajo a la rama `cursor/video-editor-mvp-d191`.
- `github`: este repositorio, https://github.com/uset82/corteo. Su `main` es lo que se ve en GitHub.

Si te falta el remoto `github`, agrégalo una vez:

```bash
git remote add github https://github.com/uset82/corteo.git
```

Para publicar en GitHub lo último de Cursor:

```bash
cd ~/corteo
git fetch origin
git push github origin/cursor/video-editor-mvp-d191:main
```

Esto no toca tus archivos ni tus ramas locales. Si GitHub pide usuario y contraseña, la contraseña es un token personal de GitHub, no la de tu cuenta. Si rechaza el push por `non-fast-forward`, `main` en GitHub tiene commits que la rama de Cursor no tiene: no uses `--force`, primero hay que integrarlos.

Para poner tu copia local al día con la de Cursor:

```bash
git switch cursor/video-editor-mvp-d191
git merge --ff-only origin/cursor/video-editor-mvp-d191
```

Si tu rama local tiene commits que Cursor no tiene (por ejemplo, de agentes locales), `--ff-only` se niega y no cambia nada; hay que integrar esos commits primero.

## Para agentes y desarrolladores

Las reglas, los comandos y el ciclo de trabajo están en [`AGENTS.md`](AGENTS.md). Antes de dar algo por terminado: `npx tsc -b`, `npm run lint`, `npm test` (unos 6 minutos; en una máquina sin GPU, `CC_RENDER_GL=swangle npm test`) y `npm run build`.

## In English

corteo is the video editor of Claudia, Carlos's AI assistant: the open AI pop star from [claudia.gallery](https://claudia.gallery), running as a Grok bot. It's a fork of [OpenChatCut](https://github.com/0xsline/OpenChatCut) with a Premiere-style timeline that runs in WSL at http://localhost:5199. Claudia decides; corteo edits and exports, on a real timeline Carlos can still adjust by hand.

What works today is upstream OpenChatCut: the multitrack timeline, keyframes, word-level captions, local Whisper transcription, 4K export, and an MCP server for clients on the same machine. Most of the interface is still in English. Connecting Claudia from outside the PC, free models for the built-in chat through DeepSeek Harness, song listening, platform import, version comparison and the full Spanish UI are planned; [`docs/plans/PROGRESS.md`](docs/plans/PROGRESS.md) tracks them.

Quick start (WSL, Node 24 via nvm): `npm install`, then `NODE_OPTIONS=--max-old-space-size=6144 npm run dev`, and open http://localhost:5199.

## Créditos y licencia

- corteo es un fork de [OpenChatCut](https://github.com/0xsline/OpenChatCut), creado por OpenChatCut Contributors. OpenChatCut se apoya a su vez en [Remotion](https://www.remotion.dev/), el [Model Context Protocol](https://modelcontextprotocol.io/), [Vercel AI SDK](https://ai-sdk.dev/) y las skills de [ChatCut-Inc/agent-plugin](https://github.com/ChatCut-Inc/agent-plugin) (ver [`src/agent/skills/NOTICE.md`](src/agent/skills/NOTICE.md)).
- Claudia es un personaje abierto de [claudia.gallery](https://claudia.gallery).
- [`README_ZH.md`](README_ZH.md) es el README original de OpenChatCut, en chino.

OpenChatCut se publica bajo la [GNU Affero General Public License v3.0 o posterior](LICENSE) (AGPL-3.0-or-later), y corteo, como obra derivada, también. En resumen (vale el texto de [`LICENSE`](LICENSE)):

- Puedes usar, estudiar, modificar y compartir corteo.
- Si lo compartes, con o sin cambios, o dejas que otras personas usen por la red una versión modificada (por ejemplo, como servicio web), tienes que ofrecerles su código fuente bajo la misma licencia.
- Se ofrece sin ninguna garantía.

Los componentes de terceros mantienen sus propias licencias (ver `package-lock.json` y [`assets/fonts/LICENSES.md`](assets/fonts/LICENSES.md)). Remotion, el motor de render, tiene [su propia licencia](https://www.remotion.dev/license): gratuita para personas y empresas pequeñas, incluso para uso comercial; las empresas más grandes necesitan una licencia de empresa.
