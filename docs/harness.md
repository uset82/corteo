# DeepSeek Harness: modelos gratis para Claudia

Guía de la parte de la máquina: instalar y arrancar el harness, conectar Claudia
(corteo) a su puerto de modelos y usar el chat propio del harness para editar la
línea de tiempo por MCP. Todo queda en loopback; no hay cuentas ni claves de pago.

## Qué piezas hay

| Pieza | Dónde | Para qué |
|-------|-------|----------|
| `dsh` (DeepSeek Harness) | `http://127.0.0.1:3080` | Chat propio del harness y cliente MCP hacia corteo |
| plugin Our Free Model | `http://127.0.0.1:18899–18909/v1` | Puerta OpenAI-compatible con las lanes gratis, protegida por clave |
| Claudia (corteo) | `http://localhost:5199` (o el puerto de tu `npm run dev`) | Consume esa puerta como proveedor `openai-compatible` |
| parche MCP | `config/harness/corteo-mcp.cordis.yml` | Mete las herramientas de corteo en el chat del harness |

El home del harness es `~/.corteo-harness` (se puede cambiar con `--home` o
`CORTEO_HARNESS_HOME`). Los pines —versión de `dsh`, tag y commit del plugin,
puertos— viven una sola vez en `config/harness.json`.

## Antes de empezar

- Linux o WSL con Node 24, `git` y `pnpm` 10:
  `npm install -g pnpm@10`.
- Unos 1–2 GB libres para el runtime y el plugin dentro de `~/.corteo-harness`.
- Nada de cuentas: se usan solo las lanes anónimas gratis del plugin.

## Instalar (una vez)

```bash
npm run harness:install
```

Qué hace, en orden:

1. Instala `@deepseek-ai/dsh@0.2.1-rc.2` en `~/.corteo-harness/runtime` (no global).
2. Clona el plugin desde su repo en el tag `v2.5.9` y comprueba que el commit sea
   `25ab765d6bb860779dbd8c53062953524f3cac09`; si no coincide, se detiene antes
   de registrarlo. Nunca se instala el paquete npm del plugin.
3. Lo enlaza al perfil `web` con `dsh plugin add`.
4. Deja `distribution: managed` en `~/.corteo-harness/our-free-model/settings.json`.

Es idempotente: una segunda pasada que ya coincide no toca nada. Si hay un
harness corriendo y hace falta reescribir ajustes, se niega y pide pararlo
(Ctrl+C) porque el plugin reescribe el archivo desde memoria.

## Arrancar

```bash
npm run harness
```

- Abre `dsh web` en `http://127.0.0.1:3080` e imprime un enlace
  `http://127.0.0.1:3080/?token=…`. Ábrelo tal cual: hasta que lo abras, la UI
  responde 401. El token es por proceso; al reiniciar cambia.
- Antes de arrancar deja el reenvío encendido en
  `~/.corteo-harness/our-free-model/settings.json`: `forward.enabled: true`,
  host `127.0.0.1`, puerto `18899`, `lan.enabled: false`. Si el puerto está
  ocupado, el plugin sube solo al siguiente libre (18900, 18901…).
- Si ya hay un harness en 3080, no arranca otro: lo dice y sale.
- Si corteo todavía no creó su token MCP, arranca sin el parche MCP y avisa.
  Abre el editor una vez y reinicia el harness para que el chat vea las
  herramientas de corteo.
- Ctrl+C lo para.

## La clave y el doctor

```bash
npm run harness:doctor
npm run harness:doctor -- --show-key
```

Comprueba cinco cosas y se detiene en la primera que falla, diciendo el arreglo:

1. Versiones instaladas frente a `config/harness.json` (dsh y commit del plugin).
2. La web responde en el puerto 3080.
3. El reenvío está encendido, no hay LAN y existe `forwardKey`.
4. El puerto real del reenvío: el primero de `18899–18909` que responde 401 sin
   clave y 200 con ella (esto también prueba que el plugin cargó).
5. Cuenta los modelos del reenvío.

Al final imprime lo que se pega en Claudia:

```
URL base: http://127.0.0.1:18899/v1
Clave:    …arcM
```

La clave sale enmascarada; con `--show-key` se ve entera. Acepta `--home`,
`--web-port` y `--forward-port` para apuntar a otra instancia.

## Conectar Claudia (corteo)

En Ajustes › modelos del agente › DeepSeek Harness (esa pantalla la añade la
parte de Qoder, HQ-1; llega a `main` en la integración H-9):

- **URL base**: la que imprimió el doctor, por ejemplo
  `http://127.0.0.1:18899/v1` o `http://127.0.0.1:18900/v1` si el puerto se movió.
- **Clave**: la del doctor.
- Usa el botón de probar/leer modelos: debe listar unos 34.

El menú de modelos de Claudia muestra luego esas mismas lanes.

## Elegir modelo

Barrido del 2026-10-25 sobre las 34 lanes, con cinco esquemas reales de edición
adjuntos y una petición por modelo: nueve contestaron 200 y ocho acertaron la
llamada `split_item`. Los tres mejores por latencia fueron
`liquid/lfm-2.5-2.6b:free` (1185 ms), `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`
(1256 ms) y `nvidia/nemotron-3-ultra-550b-a55b:free` (1769 ms, «Kilo Nemotron 3
Ultra» en el menú).

Para editar por MCP usé «Kilo Nemotron 3 Ultra» con razonamiento High: leyó la
línea de tiempo y aplicó un corte. Si una lane responde 429 está sin cuota (no es
un fallo de la instalación); las que responden 401 necesitan una cuenta y las 404
ya no existen. Cambia de modelo y listo.

Para repetir el barrido:

```bash
npm run harness:models
```

Una petición por modelo, unos cuatro minutos. El informe (modelos, argumentos y
tiempos) queda en `~/.corteo-harness/reports/` y nunca entra al repo.

## El chat del harness edita la línea de tiempo (MCP)

`npm run harness` lee el token MCP de corteo —`OPENCHATCUT_MCP_TOKEN` o
`~/.openchatcut/dev-profiles/<perfil>/mcp-token`, creado con permisos 0600 en la
primera petición MCP— y monta el parche `config/harness/corteo-mcp.cordis.yml`.
Sin token no monta nada y lo dice. La URL por defecto es
`http://localhost:5199/api/external-mcp/mcp`; si tu editor corre en otro puerto:

```bash
CORTEO_MCP_URL=http://localhost:5201/api/external-mcp/mcp npm run harness
```

El parche usa **exposición completa** de herramientas a propósito: el modo
progresivo no incluye `list_edit_sessions` ni `recover_edit_session`, y una
sesión huérfana deja el chat bloqueado sin salida.

Pídelo en lenguaje natural: «¿Qué hay en mi línea de tiempo?», «Corta el primer
clip en el segundo 2». Por dentro el modelo hace:

1. `target_project` una sola vez (elige el proyecto abierto).
2. `begin_edit_session` con `approvalMode: "auto"` y guarda el `editSessionId`.
3. `split_item`/`move_item`/… con **ese** `editSessionId`.
4. `review_edit_session` con el mismo id.

Con `auto`, el paso 4 aplica el cambio en el editor. Con `manual`, publica una
propuesta y hay que aprobarla en el editor. El id de sesión se reutiliza en todas
las llamadas: un `target_project` entre medias la deja huérfana y el chat se
queda en «An edit session is already active». Si pasa, `list_edit_sessions` y
`recover_edit_session` (resume o discard) lo resuelven.

## Privacidad

- Lo que escribes en el chat y el contexto que el modelo decida enviar viaja a la
  lane gratis elegida y de ahí a su proveedor. No hay cuentas tuyas ni claves de
  pago: por eso algunas lanes tienen cuota y otras no están disponibles.
- La clave del reenvío y el token MCP son locales. El reenvío escucha solo en
  `127.0.0.1` y la LAN está apagada.
- No pegues secretos en el chat: salen de la máquina.
- Los informes del barrido y los ajustes quedan fuera del repo.

## Lo que no se hace nunca

- Instalar el plugin desde npm: solo el tag y el commit fijados en `config/harness.json`.
- Iniciar sesión en los canales de cuenta ni en EAC: solo lanes anónimas gratis.
- Encender el reenvío LAN.
- Commitear la clave del reenvío ni el token MCP.
- Tocar `main` ni hacer force push desde la rama del harness.

## Actualizar los pines

1. Edita `config/harness.json` (versión de dsh, tag y commit del plugin, puertos).
2. Para el harness con Ctrl+C.
3. `npm run harness:install`: comprueba el commit antes de registrar y, si no
   coincide, se detiene sin tocar dsh.
4. `npm run harness:doctor`.
5. Opcional: `npm run harness:models` para rehacer el informe.
6. `npm run harness`.

## Problemas y arreglos

| Síntoma | Causa | Arreglo |
|---------|-------|---------|
| La web de dsh responde 401 o pide enlace | El token es por proceso | Abre el enlace `?token=` que imprime al arrancar; si reiniciaste, usa el nuevo |
| El doctor no encuentra el puerto del reenvío | 18899 estaba ocupado y el plugin subió a 18900+ | Usa la URL que imprime el doctor, o pasa `--forward-port 18900` |
| 401 en el reenvío | Clave mala o harness parado | `npm run harness:doctor -- --show-key` y vuelve a pegarla |
| 429 en un modelo | Esa lane agotó su cuota gratis | Espera o elige otro modelo |
| 403/404 o «región no disponible» | Esa lane no sirve desde tu red | Elige otra; el resto sigue funcionando |
| Silencio largo antes de responder | El modelo está razonando | Espera, o baja el esfuerzo de razonamiento |
| `pnpm: command not found` | Falta pnpm | `npm install -g pnpm@10` |
| `ERR_PNPM_VIRTUAL_STORE_DIR_MAX_LENGTH_DIFF` | El store de pnpm del perfil quedó inconsistente | Para dsh; borra `~/.corteo-harness/profiles/web/node_modules` y `pnpm-lock.yaml`; `npm run harness:install` y arranca |
| El install se niega porque el harness corre | El plugin reescribe ajustes desde memoria | Ctrl+C en su terminal y repite |
| El chat no ve las herramientas de corteo | Falta el token MCP o el puerto no es el del editor | Abre el editor una vez, reinicia el harness y revisa `CORTEO_MCP_URL` |
| «An edit session is already active» | Una sesión quedó huérfana al cambiar de proyecto o recargar | `list_edit_sessions` y `recover_edit_session` con discard, y repite |
