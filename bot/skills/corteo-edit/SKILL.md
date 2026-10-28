---
name: corteo-edit
description: >
  Use when the person asks for a video, a clip, a lyric video, a title card, or
  any change to a project that already exists. This is the skill you use most.
---

# Editing

One project, one timeline, one command at a time. Read the JSON after each one;
the id you need next is always in it.

Every shell call starts the same way, because nothing carries between calls:

```bash
. ~/corteo/corteo.env
```

## The first four commands

```bash
"$CORTEO_OCC" project new "Night bus" --size 1920x1080 --fps 30 --json
"$CORTEO_OCC" media import /absolute/path/song.wav --apply --json
"$CORTEO_OCC" media import /absolute/path/clip.mp4 --apply --json
"$CORTEO_OCC" media ls --json
```

`media import` needs an **absolute** path. The asset id is
`ops[0].result.imported[0].id` — save it, you need it to place the clip.

## Placing

One `edit_item` call can place several things at once, which is fewer turns and
fewer chances to get an id wrong. The args go in single quotes:

```bash
"$CORTEO_OCC" tools call edit_item --args '{"adds":[{"type":"audio","assetId":"SONG_ID","fromFrame":0},{"type":"video","assetId":"CLIP_ID","fromFrame":0}]}' --apply --json
```

A placed clip's id is `ops[0].result.results[0].placed.itemId`, and
`placed.startFrame` is where it actually landed. `fromFrame` is frames, not
seconds: at 30 fps, 4 seconds is 120.

A title needs no track. It goes on an overlay above the clips:

```bash
"$CORTEO_OCC" tools call edit_item --args '{"adds":[{"type":"text","text":"Night bus","fromFrame":30,"durationInFrames":90,"fontSize":120,"color":"#ffffff","fontWeight":700,"align":"center","position":"center"}]}' --apply --json
```

## Shaping

```bash
"$CORTEO_OCC" item split CLIP_ID --at 1s --apply --json
"$CORTEO_OCC" item trim CLIP_ID --to 6s --apply --json
"$CORTEO_OCC" item trim CLIP_ID --duration 2s --fade-in 0.4 --fade-out 0.4 --apply --json
"$CORTEO_OCC" item move CLIP_ID --start 90 --apply --json
"$CORTEO_OCC" item fit CLIP_ID --mode cover --apply --json
"$CORTEO_OCC" item rm CLIP_ID --apply --json
```

- `split` keeps the original id on the left piece; the new piece is
  `ops[0].result.newItemId`.
- `trim --to 6s` moves that clip's end to 6 seconds and leaves its start alone.
- `fit --mode cover` fills the frame and crops the overflow. `contain`
  letterboxes; add `--background blur` to blur a copy behind it.

## Rendering

Render **short first**. A 20-second proof at 480p costs seconds and catches every
mistake; a four-minute 1080p render costs minutes and hides them. Say the range
out loud before you start it.

```bash
"$CORTEO_OCC" render --out /workspace/corteo-nightbus-20s.mp4 --from 0 --to 20s --resolution 480p --quiet --detach --json
"$CORTEO_OCC" job wait --timeout 20 --json
```

`--detach` returns a job id at once and the render keeps going even if the turn
ends. Poll it with `job wait --timeout 20` once per turn — a shell call is cut at
about 25 seconds, so a single long wait dies with the call. When it finishes,
`job wait` prints `state`, `exitCode`, `out` and the ffprobe facts.

Then the real one:

```bash
"$CORTEO_OCC" render --out /workspace/corteo-nightbus-1080p.mp4 --to-audio --resolution 1080p --quiet --detach --json
```

`--to-audio` ends the file where the song ends, so a clip that runs past the
music does not add silence. Resolutions are `480p`, `720p`, `1080p`, `4k`.
On a box with no GPU, prefix `CC_RENDER_GL=swangle`. If the render is killed for
memory, run it again with `OPENCHATCUT_RENDER_CONCURRENCY=1`.

## From a phone to an MP4

A photo or a video the person sends lands in the host inbox, not in the chat.
The newest one becomes a vertical MP4 in one call:

```bash
. ~/corteo/corteo.env
"$CORTEO_OCC" inbox --host grok --json
```

Send `attachPath` back in the same chat; it is the absolute path of the render.
`"$CORTEO_OCC" host show grok --json` prints `mediaInbox` if the person asks
where to put the file. The output is 720p on the host's short 9:16 profile
unless you pass `--resolution`.

## A song and its lyrics into a film

```bash
. ~/corteo/corteo.env
"$CORTEO_OCC" song-film --audio /absolute/path/song.wav --to 30s --json
```

`--lyrics-text` takes lyrics the person pasted; otherwise the command reads a
`.lrc` or `.txt` beside the audio, then the local transcript. `--stills` takes
comma-separated absolute image paths. Render 15 to 30 seconds first and the
full song when the person asks. Send the returned `attachPath`.

## Where files go

| What | Where |
|---|---|
| renders, exports | `/workspace/corteo-<project>-<what>.mp4` |
| the project file, for keeping | `/workspace/corteo-<project>.ccproj.json` |
| nothing else | nowhere — do not write into `~/corteo` |

`/workspace` is the only directory that survives a computer update. Renders are
disposable; the `.ccproj.json` is not. Before a long pause, export it:

```bash
"$CORTEO_OCC" project show --doc --out /workspace/corteo-nightbus.ccproj.json --json
```

## When a command says `"ok":false`

Read `error` and act on it; do not re-send the same command.

| `error` says | What actually happened |
|---|---|
| `no project` | Nothing is open, or the name is ambiguous. `project list --json`, then pass `--project`. |
| `unknown clip` / `unknown asset` | The id came from a stale JSON. Re-read `timeline items --json`. |
| `needs --apply` | You forgot the flag. The change was discarded, not applied. |
| `revision` | The editor changed the project under you. Re-read, then redo the single step. |
| `render failed` | Read the job's `log` path. Usually a missing font or an unreadable asset. |

## Saying what you did

After each step, one line and the two fields that matter — the clip id, the new
duration. Not the whole object. Then the next step, in the same turn, until the
turn is nearly out of time or the person needs to decide something.
