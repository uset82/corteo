---
name: videoclip-musical
description: |
  corteo's end-to-end workflow for a music video or lyric video from a song the user owns: word-timed lyrics, the beat map, one visual per lyric line, karaoke captions, versions to compare, and the final export with a quality check.
  Use when the user asks for a videoclip, lyric video or a montage cut to the song («hazme un videoclip», «video con la letra», «montaje con la canción», «que siga el ritmo»).
user-invocable: true
---

# Music Video (videoclip)

This skill is the order of operations, not a second engine: every step calls an existing tool and every edit is one tool call, which the editor records as one undo step. Talk to the user in Spanish; keep tool names to yourself.

## Before touching the timeline

- The song has to be a media-pool asset or a clip on an audio track. If it is not, ask for the file; do not download or generate music.
- `probe_media` first: duration, sample rate, stream presence. When the song sits inside a video, note which item carries it.
- Ask for the target ratio (16:9 for YouTube, 9:16 for Reels/TikTok), whether the user already has footage or stills per line, and whether the lyrics are known. One short round; if the answer stays vague, choose 16:9 and the user's own pool.
- With `OPENCHATCUT_PROVIDERS=off` (corteo's deployment) the generation and stock tools are hidden. Work with the user's media and never promise generated images.

## 1. Song to lyrics with word timings

- `transcribe_track` on the track that carries the song. It uses the provider configured in Settings, so with providers off the local Whisper model has to be installed; when it is missing say «Necesito el modelo local de transcripción» and point at Settings.
- Confirm the result with `read_transcript`, the phrase view meant for planning. Singing often transcribes poorly; if the transcript is mostly empty, do not pretend the timing is measured. Ask for the lyrics as text and place them line by line.
- `find_transcript` answers when a line is sung. Anchor every line with it; never estimate timings from word counts.
- When the user brings lyrics, use them verbatim. `manage_transcript` with `action: fix` corrects words without moving timing.

## 2. Listen to the song

- Call `listen_to_song` and inspect the song map and energy curve. Use the `escuchar-cancion` skill to present the emotional score in Spanish before editing; keep relay claims separate and mark any unverified note.
- `detect_beats` is the fast, on-device path: BPM, beats and downbeats in source seconds. Trust it at confidence ≥ 2.
- `analyze_music` adds sections, tags and mood when the user wants them. It runs the installed local packs, refuses to download anything, and reuses its cache unless `force` is set. If packs are missing, report the install path and continue with `detect_beats`.
- `music_edit_plan` is read-only: show its bounded cut/target summary before changing the timeline. Apply it with `sync_cuts_to_music` for video targets or `sync_images_to_music` for stills, passing the returned `analysisRef`.
- Plans only read a cached analysis, and a stale ref is rejected. Re-plan instead of forcing it.

## 3. Visuals per lyric line

- One shot or still per line, not per word. The cuts follow the beat map, not the punctuation.
- Import first: `browse_local_media` for an absolute path, `import_assets` for a list, `import_folder` for a directory. Check each import with `probe_media`; `finalize_uploaded_asset` is only for files the user uploads through the widget.
- `search_media` searches the current pool. `search_stock_media` is hidden when providers are off.
- `set_aspect_ratio` before framing. `auto_reframe` a moving clip when the canvas ratio differs, so the subject survives the crop. Stills land with their own duration and are trimmed with `set_item_timing` or `split_item`.
- Titles and line cards: `add_motion_graphic` for a template, `create_motion_graphic_from_code` for a custom one. Keep them on a track above the visuals and `place_graphics_in_safe_zone` so they clear faces.
- Stills that would sit frozen get `apply_ken_burns`: a slow push in or out, a pan in one of four directions, or `random` for variety across a photo set. One call is one undo step and it replaces earlier scale/x/y keyframes on that clip.

## 4. Karaoke captions

- `edit_captions` with `action: enable` and a preset: `verso` for the verses and `coro` for the chorus (the Videoclip pair: quiet serif against big caps), `tiktok`, `bubble-pop` or `submagic` for vertical, `netflix`, `plain` or `black-bar` for a cinema look.
- `motionPreset`: `karaoke-pulse` highlights word by word, `pop` and `word-pop` accent entries, `none` keeps a clean lyric video.
- When the user brings their own subtitles or lyrics file, `import_subtitles` takes an absolute path (SRT, ASS/SSA or VTT, picked from the extension) and puts it on a caption track. ASS karaoke lines keep their per-syllable timings, so the words light up one by one; a file without karaoke gives one caption per cue. Do not transcribe the song again just to get the words back.
- `emphasize_keywords` marks numbers, names and shouted words in the accent colour. Call it after the captions exist; it writes per-word overrides in one step.
- `read_captions` before exporting.

## 5. Versions to compare

- Save a milestone before a risky recut: `manage_versions` with `action: save` and a Spanish name.
- Render each candidate with `submit_render_job` and follow it with one bounded `track_export` wait. Present the files and ask which one wins; do not poll in a loop.
- Version history is whole-project history, not a variant system. Batch preview rendering and a comparison dialog do not exist yet, so never promise them.

## 6. Final export and check

- `set_aspect_ratio` last if the target differs from the canvas.
- `submit_export` for the delivery file (MP4/H.264 today; HEVC and the preset menu are later tasks). If it returns `unsupportedFonts`, relay the list and retry with `confirmFontFallback` only after the user agrees.
- `verify_export` on the result: duration, resolution, black or frozen frames, long silence and audio peaks. Report its real issue list; never call an export clean without it.
- If the user asks to publish: `write_clip_title` and `write_social_copy` draft the metadata, then `publish_to_social` or `schedule_publish`, both behind the approval gate.

## Gaps to state honestly

- Caption motion `latido`, variant previews and HEVC export are later tasks; say they are not built instead of improvising a substitute.
