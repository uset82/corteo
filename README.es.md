# corteo

[English](README.md) · Español

**El editor de videoclips que maneja un bot.**

corteo es un editor de video en español para hacer videoclips. Es un fork de [OpenChatCut](https://github.com/0xsline/OpenChatCut) con una línea de tiempo al estilo de Premiere, corre en WSL en http://localhost:5199 y está pensado para que un bot lo maneje por MCP: un Grok Bot, Claude Code o Codex. El repositorio, sus carpetas y el comando que lo arranca también se llaman **corteo**.

## Qué es y por qué

Un bot puede pensar un videoclip y generar material con Grok, pero para editarlo necesita un brazo: este editor. corteo es ese brazo, y el bot manda: elige qué imagen acompaña cada verso, dónde entra el coro y cómo se mueve cada plano.

El reparto es simple:

- **El bot decide**: qué imagen acompaña cada verso, dónde entra el coro, cómo se mueve cada plano.
- **El editor ejecuta**: importa, corta, anima, subtitula y exporta en una línea de tiempo real, que Carlos puede revisar y retocar a mano.

El primer objetivo son los videoclips de Carlos, como el de «Perú», su canción de protesta.

## Estado

El estado de cada tarea está en [`docs/plans/PROGRESS.md`](docs/plans/PROGRESS.md), y los planes completos en [`docs/plans/01-editor-claudia.md`](docs/plans/01-editor-claudia.md) (el editor y la conexión con el bot), [`docs/plans/02-claudia-escucha.md`](docs/plans/02-claudia-escucha.md) (el bot escucha la canción), [`docs/plans/03-deepseek-harness.md`](docs/plans/03-deepseek-harness.md) (modelos gratis para el chat del editor) y [`docs/plans/04-claudia-brand.md`](docs/plans/04-claudia-brand.md) (el nombre y la imagen de corteo). Si este README y `PROGRESS.md` no coinciden, vale `PROGRESS.md`.

### Lo que funciona hoy

El nombre y la imagen son de corteo: la piel «corteo» por defecto, con su propio acento; la página de proyectos, la barra superior y el panel de chat con la nueva cabecera; el título de la pestaña; los nombres de las exportaciones a Final Cut y CapCut, y la página para subir medios desde el móvil.

Las funciones vienen todas de OpenChatCut:

- Línea de tiempo multipista con herramientas y atajos al estilo de Premiere (V, B, N, U, P, Q/W, I/O, J/K/L).
- Fotogramas clave con curvas de aceleración, que se ven igual en la vista previa y en el video exportado.
- 22 estilos de subtítulos con resaltado palabra por palabra, tipo karaoke.
- Transcripción local con Whisper.
- Exportación hasta 4K en H.264 y VP8, y en ProRes desde el servidor.
- Varias secuencias por proyecto, transiciones, efectos, LUTs, plantillas animadas y varias pistas de audio.
- Un servidor MCP con token y unas 120 herramientas de edición. Hoy lo pueden usar los clientes MCP que corren en el mismo PC (Codex, Claude Code, Qoder…).

Y una cosa nueva: el chat del editor funciona con modelos gratis a través de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) y el plugin [Our Free Model](https://github.com/Ebony-Vinyl/dsh-our-free-model). Sus modelos salen en el menú de modelos del chat. El de por defecto es `nvidia/nemotron-3-ultra-550b-a55b:free`: de los que llamaron bien a la herramienta de corte, es el que de verdad cortó un clip. El chat del propio harness también puede editar la línea de tiempo por MCP. Cómo arrancarlo: [Modelos gratis con DeepSeek Harness](#modelos-gratis-con-deepseek-harness). La guía larga está en [`docs/harness.md`](docs/harness.md).

La noche de evolución del 28 de octubre añadió esto, cada cosa con su prueba y, cuando hubo, con su prueba en vivo:

- **Perfiles de host**: `install.sh --host-profile grok|muse|claude-duet` deja el skill, la bandeja de medios y la carpeta de exportaciones donde los busca cada bot (EV-01, EV-02).
- **Del teléfono al MP4**: `occ inbox --host grok --json` recoge el clip que el bot dejó en su bandeja, lo importa a un proyecto y devuelve el `attachPath` para mandarlo de vuelta por el chat (EV-05).
- **Película de una canción**: `occ song-film --audio cancion.mp3 --to 30s --json` corta por downbeats, anima cada plano y renderiza un MP4 vertical; un ejemplo real salió 1080x1920 y 30 s (EV-09, EV-10).
- **Shorts con revisión**: `reviewEs` puntúa y corta los rangos de palabras antes del lote; necesita la pestaña del editor abierta con `npm run editor-host` (EV-11).
- **El cerebro gratis**: `npm run brain` levanta el router con los alias `grok`, `muse` y `claude-duet`; el tool `delegate` reparte el trabajo entre ellos, el editor los ve en `http://127.0.0.1:18899/v1` y la puerta para cualquier IDE es `http://127.0.0.1:18890/v1`. Se probó en vivo en esta máquina (EV-13 a EV-20).
- **El instalador enciende el cerebro**: el paso `CORTEO_BRAIN` deja `CORTEO_BRAIN=ok`, `failed` o `skipped` en el reporte (EV-17).
- **La música en la interfaz**: el inspector tiene la sección «Reaccionar a la música», la línea de tiempo el «Mapa musical» y la insignia de la canción el «Mapa de la canción». Sus pruebas pasan; verlo en un navegador real quedó pendiente (EV-22 a EV-24, EV-29).

Con dos salvedades:

- La interfaz arranca en español, pero solo unos 200 de sus 2.520 textos están traducidos: la página de proyectos, la barra superior y lo primero que se ve del chat. El resto sale en inglés.
- Con `OPENCHATCUT_PROVIDERS=off` (el alias `corteo` y `npm run start:corteo`) el chat solo usa DeepSeek Harness, Ollama y LM Studio. Las rutas de generación, de stock y de transcripción en la nube responden 403, y esos ajustes no se muestran.

### Lo que falta

| Qué | Tareas |
|---|---|
| «El bot escucha la canción»: L-01 a L-12 ya están; quedan la prueba de punta a punta con una canción real y ver la interfaz musical en el navegador | L-13, EV-33 |
| Ken Burns, subtítulos de verso y coro, importar ASS/VTT, detector de tomas repetidas, exportación HEVC, cuenta regresiva, atajos de Premiere | P2-1 a P2-6 |
| Importar desde YouTube, Vimeo o Bilibili con sus créditos (yt-dlp) | P3-1 a P3-4 |
| Varias versiones de un videoclip y la vista «Comparar versiones» | P4-1 a P4-3 |
| Toda la interfaz en español | P5-1 a P5-3 |
| Prueba completa con un bot, de la canción al video exportado | P6-1 |

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

## Instalar en tu bot (Grok Bot)

Dile a tu bot: «Instala corteo y úsalo para crear y editar mis videos en tu máquina.»

Ella ejecuta esto una vez. No pide claves. Al final imprime `CORTEO_SELF_TEST=PASS`.

```bash
curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash
```

El editor queda en `~/corteo`. Aunque el shell traiga Node 20 y `NPM_CONFIG_PREFIX`, el instalador los aparta y usa Node 24. Lo arranca con `npm run corteo:local` y lo maneja con `~/corteo/scripts/corteo`, sin preparar el shell. La guía para el bot está en [`skills/corteo/SKILL.md`](skills/corteo/SKILL.md). El túnel de Cloudflare es opcional y solo sirve para abrir el editor en un navegador.

## Uso

```bash
cd ~/corteo
NODE_OPTIONS=--max-old-space-size=6144 npm run dev
```

Abre **http://localhost:5199** en Chrome o Edge en Windows. Usa `localhost` y no la IP de WSL: el navegador solo activa las funciones de video que necesita el editor (WebCodecs, Web Crypto) en `localhost` o con HTTPS. Para parar el servidor, Ctrl+C en esa terminal.

El servidor arranca con 6 GB de memoria (`OPENCHATCUT_DEV_HEAP_MB`, por defecto 6144). Ya no hace falta poner `NODE_OPTIONS` a mano.

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

Hoy eso sirve para un cliente en la misma máquina. El bot usa su propia máquina: [El bot en su propia máquina](#el-bot-en-su-propia-máquina). El túnel de más abajo es opcional.

### El bot en su propia máquina

El bot no corre en el PC de Carlos: tiene una máquina Linux propia. Ahí clona este repo y arranca el editor en local. No hace falta el túnel ni que el PC de Carlos esté encendido.

El instalador deja Node 24. En una terminal:

```bash
npm run corteo:local
```

Eso escucha solo en `http://127.0.0.1:5199`. El MCP está en `http://127.0.0.1:5199/api/external-mcp/mcp`. El token no se imprime solo: `~/corteo/scripts/corteo mcp token` dice la ruta, y `--show` imprime el token en stdout. Los proveedores de pago quedan apagados. En otra terminal, el shell (sin navegador, y sin depender de que `node` sea la 24):

```bash
~/corteo/scripts/corteo project new "Prueba" --json
~/corteo/scripts/corteo media import /ruta/absoluta/clip.mp4 --apply --json
~/corteo/scripts/corteo tools call edit_item --args '{"adds":[{"type":"video","assetId":"ID","fromFrame":0}]}' --apply
~/corteo/scripts/corteo project show Prueba --doc --out proyecto.json
CC_RENDER_GL=swangle ~/corteo/scripts/corteo render --out /ruta/salida.mp4
```

`proyecto.json` es el documento del proyecto para leerlo. El archivo no es la biblioteca: para cambiar el corte se usa el shell. Sin GPU, `CC_RENDER_GL=swangle`.

### Publicar el editor (opcional)

Esto es solo para abrir el mismo editor en un navegador fuera de la máquina. El bot no lo necesita.

https://corteo.uset82.workers.dev/ deja de ser una copia estática y pasa a ser el editor que corre en tu PC. Quien abre esa dirección ve tus proyectos y usa los modelos gratis. El bot llama a `https://corteo.uset82.workers.dev/api/external-mcp/mcp` con el token. Es un solo editor compartido: el chat gasta la cuota gratis de tu PC, y la clave de reenvío no sale de tu PC.

Hace falta un túnel con nombre en un dominio de tu cuenta de Cloudflare, por ejemplo `editor.uset82.com`. Un túnel rápido (`trycloudflare.com`) corta el stream del chat y de MCP. Ese dominio solo lo usa el Worker por dentro. La dirección pública sigue siendo `corteo.uset82.workers.dev`.

**1. El token y el arranque**, una vez:

```bash
cd ~/corteo
cp .env.corteo.example .env.corteo
# escribe un token en OPENCHATCUT_MCP_TOKEN (el ejemplo dice cómo generarlo)
npm run harness
```

Deja esa terminal abierta. En otra:

```bash
cd ~/corteo && npm run start:corteo
```

Y en otra, para que el bot pueda editar aunque nadie tenga la página abierta:

```bash
cd ~/corteo && npx playwright install chromium
npm run editor-host
```

**2. El túnel.** Edita [`cloudflare/tunnel.yml`](cloudflare/tunnel.yml): el hostname, y la ruta del archivo de credenciales que crea `cloudflared tunnel create corteo`. Luego:

```bash
cloudflared tunnel route dns corteo editor.uset82.com
npm run tunnel
```

**3. El Worker**, una vez, con la cuenta de Cloudflare que ya tiene `corteo.uset82.workers.dev`. Si tu hostname no es `editor.uset82.com`, cámbialo en `wrangler.jsonc` (`TUNNEL_ORIGIN`) y en `cloudflare/tunnel.yml`.

```bash
npx wrangler deploy
```

Eso sustituye la copia estática. Los proyectos que solo existían en el navegador de esa copia dejan de verse: la página muestra los del PC.

**4. El bot.** En el editor, «Agentes externos (MCP)» → «Conectar corteo». Copia el snippet. En el bot, `OPENCHATCUT_MCP_URL` es `https://corteo.uset82.workers.dev/api/external-mcp/mcp`, `OPENCHATCUT_MCP_TOKEN` es el de `.env.corteo`, y `hosting.egressDomains` incluye `corteo.uset82.workers.dev`.

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

corteo is a Spanish music-video editor that a bot drives over MCP: a Grok Bot, Claude Code or Codex. The repository, its folders and the command that starts it are all called corteo. It's a fork of [OpenChatCut](https://github.com/0xsline/OpenChatCut) with a Premiere-style timeline that runs in WSL at http://localhost:5199. The bot decides; the editor edits and exports, on a real timeline Carlos can still adjust by hand.

The features that work today are upstream OpenChatCut's: the multitrack timeline, keyframes, word-level captions, local Whisper transcription, 4K export, and an MCP server for clients on the same machine. The name and the look are corteo's. The projects page, the top bar and the chat's first view are in Spanish; most of the rest is still in English. The built-in chat runs on free models through DeepSeek Harness (`npm run harness:install`, `npm run harness`, `npm run harness:doctor`; the Spanish steps are under "Modelos gratis con DeepSeek Harness" above, and the long guide is `docs/harness.md`). Connecting a bot from outside the PC, song listening, platform import, version comparison and the full Spanish UI are planned; [`docs/plans/PROGRESS.md`](docs/plans/PROGRESS.md) tracks them.

Quick start (WSL, Node 24 via nvm): `npm install`, then `NODE_OPTIONS=--max-old-space-size=6144 npm run dev`, and open http://localhost:5199.

## Créditos y licencia

- corteo es un fork de [OpenChatCut](https://github.com/0xsline/OpenChatCut), creado por OpenChatCut Contributors. OpenChatCut se apoya a su vez en [Remotion](https://www.remotion.dev/), el [Model Context Protocol](https://modelcontextprotocol.io/), [Vercel AI SDK](https://ai-sdk.dev/) y las skills de [ChatCut-Inc/agent-plugin](https://github.com/ChatCut-Inc/agent-plugin) (ver [`src/agent/skills/NOTICE.md`](src/agent/skills/NOTICE.md)).
- La tipografía de marca está en `public/fonts/corteo/` con su licencia: DINish Condensed, de The DINish Project Authors, en los títulos y el logotipo, bajo la [SIL Open Font License 1.1](public/fonts/corteo/OFL-DINish.txt).
- [`README_ZH.md`](README_ZH.md) es el README original de OpenChatCut, en chino.

OpenChatCut se publica bajo la [GNU Affero General Public License v3.0 o posterior](LICENSE) (AGPL-3.0-or-later), y este editor, como obra derivada, también. En resumen (vale el texto de [`LICENSE`](LICENSE)):

- Puedes usar, estudiar, modificar y compartir este editor.
- Si lo compartes, con o sin cambios, o dejas que otras personas usen por la red una versión modificada (por ejemplo, como servicio web), tienes que ofrecerles su código fuente bajo la misma licencia.
- Se ofrece sin ninguna garantía.

Los componentes de terceros mantienen sus propias licencias (ver `package-lock.json` y [`assets/fonts/LICENSES.md`](assets/fonts/LICENSES.md)). Remotion, el motor de render, tiene [su propia licencia](https://www.remotion.dev/license): gratuita para personas y empresas pequeñas, incluso para uso comercial; las empresas más grandes necesitan una licencia de empresa.
