---
name: escuchar-cancion
description: |
  Escucha y analiza una canción para planear un videoclip o vídeo con letra y movimiento musical.
  Use when the user says «escucha esta canción», «haz un vídeo con esta canción», «sigue el ritmo» or asks for an emotional music map.
user-invocable: true
---

# Escuchar una canción

1. Call `listen_to_song` on the song and inspect both returned pictures: the song map and the energy curve. Use `detect_beats` for a longer timeline downbeat list. Distinguish measured features, model tags and your own interpretation; report missing packs or uncertainty honestly.
2. If the optional listening relay supplied a note, treat it as a report: separate what it heard from your conclusions, check physical claims against the map and say when a note is unverified. A transcript is a guess. Prefer lyrics pasted by the person, then a `.lrc` beside the song, then a `.txt` beside it, then the local transcript; never override the person's words.
3. Before any edit, present a **partitura emocional** in Spanish. For every section give the section, feeling, intensity from 0 to 10, visual intent (motion, cutting pace, look and caption style), and a short lyric quote when available. Mark missing lyrics rather than inventing a quote.
4. Translate the partitura into a single version using this mapping, adjusting it to the actual song:

| Section | Visual intent |
|---|---|
| Quiet melancholic intro | Slow `apply_ken_burns`, cuts only on section changes, cool look |
| Build | A growing `pulso` |
| Drop or peak | `golpe` and `destello` on downbeats, cuts on the beat, `temblor` on accents |
| Break | `respirar` |
| Outro | Zoom out and fade |

5. Use `music_reaction_plan` to inspect targets and timing, then `apply_music_reaction` to apply appropriate motion; `clear_music_reaction` removes it if needed. Place or adjust visuals with `edit_item` and lyrics with `edit_captions`. Respect locked tracks, keep edits undoable, and explain unavailable model analysis instead of claiming the reaction was applied. When the user wants alternatives, create 2 to 4 versions with labels and notes using `create_variants`; it returns their timeline ids, and each one is edited with the timeline-targeted tools. Record the user’s choice with `choose_variant` and read it with `get_variant_choice`. Render 480p previews for those versions with `render_variant_previews`; the comparison dialog is not built yet.
