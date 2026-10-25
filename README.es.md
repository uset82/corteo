# Claudia

[English](README.md) · Español

**El editor de videoclips de Claudia.**

Claudia es un editor de video en español para hacer videoclips. Es un fork de [OpenChatCut](https://github.com/0xsline/OpenChatCut) con una línea de tiempo al estilo de Premiere, corre en WSL en http://localhost:5199 y está pensado para que Claudia, la asistente de IA de Carlos, lo maneje por MCP. El repositorio, sus carpetas y el comando que lo arranca se siguen llamando **corteo**.

## Qué es y por qué

[Claudia](https://claudia.gallery) es una popstar de IA abierta: un personaje que cualquiera puede usar. Para Carlos es además su asistente, un bot de Grok. Claudia puede pensar un videoclip y generar material con Grok, pero para editarlo necesita un brazo: este editor, que por eso lleva su nombre.

El reparto es simple:

- **Claudia decide**: qué imagen acompaña cada verso, dónde entra el coro, cómo se mueve cada plano.
- **El editor ejecuta**: importa, corta, anima, subtitula y exporta en una línea de tiempo real, que Carlos puede revisar y retocar a mano.

El primer objetivo son los videoclips de Carlos, como el de «Perú», su canción de protesta.

## Estado

El estado de cada tarea está en [`docs/plans/PROGRESS.md`](docs/plans/PROGRESS.md), y los planes completos en [`docs/plans/01-editor-claudia.md`](docs/plans/01-editor-claudia.md) (el editor y la conexión con Claudia), [`docs/plans/02-claudia-escucha.md`](docs/plans/02-claudia-escucha.md) (Claudia escucha la canción), [`docs/plans/03-deepseek-harness.md`](docs/plans/03-deepseek-harness.md) (modelos gratis para el chat del editor) y [`docs/plans/04-claudia-brand.md`](docs/plans/04-claudia-brand.md) (el nombre y la imagen de Claudia). Si este README y `PROGRESS.md` no coinciden, vale `PROGRESS.md`.

### Lo que funciona hoy

El nombre y la imagen son de Claudia: la piel «Claudia» por defecto, con el color y las tipografías de claudia.gallery; la página de proyectos, la barra superior y el panel de chat con la nueva cabecera; el título de la pestaña; los nombres de las exportaciones a Final Cut y CapCut, y la página para subir medios desde el móvil.

Las funciones vienen todas de OpenChatCut:

- Línea de tiempo multipista con herramientas y atajos al estilo de Premiere (V, B, N, U, P, Q/W, I/O, J/K/L).
- Fotogramas clave con curvas de aceleración, que se ven igual en la vista previa y en el video exportado.
- 22 estilos de subtítulos con resaltado palabra por palabra, tipo karaoke.
- Transcripción local con Whisper.
- Exportación hasta 4K en H.264 y VP8, y en ProRes desde el servidor.
- Varias secuencias por proyecto, transiciones, efectos, LUTs, plantillas animadas y varias pistas de audio.
- Un servidor MCP con token y unas 120 herramientas de edición. Hoy lo pueden usar los clientes MCP que corren en el mismo PC (Codex, Claude Code, Qoder…).

Y una cosa nueva de Claudia: el chat del editor funciona con modelos gratis a través de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) y el plugin [Our Free Model](https://github.com/Ebony-Vinyl/dsh-our-free-model). Sus modelos salen en el menú de modelos del chat. El de por defecto es `nvidia/nemotron-3-ultra-550b-a55b:free`: de los que llamaron bien a la herramienta de corte, es el que de verdad cortó un clip. El chat del propio harness también puede editar la línea de tiempo por MCP. Cómo arrancarlo: [Modelos gratis con DeepSeek Harness](#modelos-gratis-con-deepseek-harness). La guía larga está en [`docs/harness.md`](docs/harness.md).

Con dos salvedades:

- La interfaz arranca en español, pero solo unos 200 de sus 2.520 textos están traducidos: la página de proyectos, la barra superior y lo primero que se ve del chat. El resto sale en inglés.
- Los proveedores de pago de OpenChatCut y sus funciones de generación (imágenes, voz, video, música) siguen ahí. Con `OPENCHATCUT_PROVIDERS=off` (ya va en el [alias `corteo`](#el-alias-corteo)) el editor solo muestra y deja usar DeepSeek Harness, Ollama y LM Studio. Quitar la generación del todo son las tareas P1-1 y P1-2.

### Lo que falta

| Qué | Tareas |
|---|---|
| Que el servidor tenga memoria suficiente sin `NODE_OPTIONS` | P0-2 |
| Conectar a Claudia desde fuera de tu PC: `npm run start:claudia`, token fijo, túnel, tarjeta «Conectar Claudia» y una pestaña del editor sin pantalla para exportar por MCP | P0-3, P1-3 a P1-5 |
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

**2. El repositorio, corteo**

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
echo 'alias corteo="cd ~/corteo && OPENCHATCUT_PROVIDERS=off VITE_CONFIG_NATIVE_IGNORE_WARNING=true NODE_OPTIONS=--max-old-space-size=6144 npm run dev"' >> ~/.bashrc
source ~/.bashrc
```

Desde entonces, escribir `corteo` en cualquier terminal de WSL arranca el editor. `OPENCHATCUT_PROVIDERS=off` deja solo los modelos gratis y locales (DeepSeek Harness, Ollama, LM Studio): esconde los proveedores de pago y el servidor rechaza sus llamadas. `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` solo oculta una lista larga de avisos inofensivos de Vite al arrancar.

Si ya tenías el alias de antes, cámbialo: borra la línea `alias corteo=…` de `~/.bashrc` y vuelve a ejecutar los dos comandos de arriba.

### Modelos gratis con DeepSeek Harness

En tu PC el harness ya está en `~/.corteo-harness`. Estos comandos lo instalan, lo arrancan y te dan la clave. La guía completa, con privacidad y problemas típicos, está en [`docs/harness.md`](docs/harness.md).

**1. Instalarlo**, una vez (si ya está, imprime «Nada que hacer»):

```bash
cd ~/corteo && npm run harness:install
```

**2. Arrancarlo**, en una terminal de WSL aparte, y dejarla abierta:

```bash
npm run harness
```

Ctrl+C lo para. Si el puerto 3080 ya responde, dice que ya está en marcha y no arranca otro. Abre el enlace que imprima, tal cual: puede llevar el token de acceso.

**3. La dirección y la clave**, en otra terminal:

```bash
npm run harness:doctor -- --show-key
```

Imprime la URL (normalmente `http://127.0.0.1:18899/v1`) y la clave. Sin `--show-key` la clave sale enmascarada. Es una clave local: no la pegues en chats ni la subas a git.

**4. Conectarlo al editor**: en Ajustes › Agent Model › DeepSeek Harness (esa parte de los ajustes aún sale en inglés), pega la dirección y la clave, y pulsa «Test & load models». Solo hace falta una vez.

**5. El modelo**: en el chat, menú «Modelo», grupo DeepSeek Harness. El de por defecto es `nvidia/nemotron-3-ultra-550b-a55b:free`. En el barrido del 25 de octubre, ocho modelos llamaron bien a la herramienta de corte; los dos más rápidos fallaron al editar de verdad (uno se quedó sin cuota y el otro no abrió la línea de tiempo), y este sí cortó un clip. Si un modelo dice que está ocupado o sin cuota, elige otro. `npm run harness` también deja que el chat del propio harness edite el proyecto por MCP.

### Tus datos

`npm run dev` guarda los proyectos, los medios importados, los ajustes y el token MCP en `~/.openchatcut/dev-profiles/<id>/`, una carpeta por cada copia del repo (la línea `[OpenChatCut] isolated profile <id>` del arranque dice cuál). Para hacer una copia de seguridad, copia `~/.openchatcut`.

### Conectar un cliente MCP

- Dirección: `http://localhost:5199/api/external-mcp/mcp`, con el encabezado `Authorization: Bearer <token>`.
- Token: en la página de proyectos, el botón de arriba a la derecha «Agentes externos (MCP)» (el nombre aparece al pasar el ratón), o el archivo `mcp-token` de la carpeta de tu perfil.

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

Claudia is a Spanish music-video editor, named after the one who drives it over MCP: Claudia, Carlos's AI assistant, the open AI pop star from [claudia.gallery](https://claudia.gallery), running as a Grok bot. The repository, its folders and the command that starts it are still called corteo. It's a fork of [OpenChatCut](https://github.com/0xsline/OpenChatCut) with a Premiere-style timeline that runs in WSL at http://localhost:5199. Claudia decides; the editor edits and exports, on a real timeline Carlos can still adjust by hand.

The features that work today are upstream OpenChatCut's: the multitrack timeline, keyframes, word-level captions, local Whisper transcription, 4K export, and an MCP server for clients on the same machine. The name and the look are Claudia's, from claudia.gallery. The projects page, the top bar and the chat's first view are in Spanish; most of the rest is still in English. The built-in chat runs on free models through DeepSeek Harness (`npm run harness:install`, `npm run harness`, `npm run harness:doctor`; the Spanish steps are under "Modelos gratis con DeepSeek Harness" above, and the long guide is `docs/harness.md`). Connecting Claudia from outside the PC, song listening, platform import, version comparison and the full Spanish UI are planned; [`docs/plans/PROGRESS.md`](docs/plans/PROGRESS.md) tracks them.

Quick start (WSL, Node 24 via nvm): `npm install`, then `NODE_OPTIONS=--max-old-space-size=6144 npm run dev`, and open http://localhost:5199.

## Créditos y licencia

- Claudia (este repositorio, corteo) es un fork de [OpenChatCut](https://github.com/0xsline/OpenChatCut), creado por OpenChatCut Contributors. OpenChatCut se apoya a su vez en [Remotion](https://www.remotion.dev/), el [Model Context Protocol](https://modelcontextprotocol.io/), [Vercel AI SDK](https://ai-sdk.dev/) y las skills de [ChatCut-Inc/agent-plugin](https://github.com/ChatCut-Inc/agent-plugin) (ver [`src/agent/skills/NOTICE.md`](src/agent/skills/NOTICE.md)).
- Claudia es un personaje abierto de [claudia.gallery](https://claudia.gallery).
- Las dos tipografías de marca están en `public/fonts/claudia/` con sus licencias: TeX Gyre Heros, del GUST e-foundry, en el logotipo, bajo la [GUST Font License](public/fonts/claudia/GUST-FONT-LICENSE.txt); y DINish Condensed, de The DINish Project Authors, en los títulos, bajo la [SIL Open Font License 1.1](public/fonts/claudia/OFL-DINish.txt).
- [`README_ZH.md`](README_ZH.md) es el README original de OpenChatCut, en chino.

OpenChatCut se publica bajo la [GNU Affero General Public License v3.0 o posterior](LICENSE) (AGPL-3.0-or-later), y este editor, como obra derivada, también. En resumen (vale el texto de [`LICENSE`](LICENSE)):

- Puedes usar, estudiar, modificar y compartir este editor.
- Si lo compartes, con o sin cambios, o dejas que otras personas usen por la red una versión modificada (por ejemplo, como servicio web), tienes que ofrecerles su código fuente bajo la misma licencia.
- Se ofrece sin ninguna garantía.

Los componentes de terceros mantienen sus propias licencias (ver `package-lock.json` y [`assets/fonts/LICENSES.md`](assets/fonts/LICENSES.md)). Remotion, el motor de render, tiene [su propia licencia](https://www.remotion.dev/license): gratuita para personas y empresas pequeñas, incluso para uso comercial; las empresas más grandes necesitan una licencia de empresa.
