---
name: shorts-virales
description: Turn ONE long video into several vertical, publishable shorts, scored with the Gancho/Flujo/Valor/Sonido rubric. Use only when the user explicitly asks for it — "convierte este vídeo largo en shorts", "sácame clips virales", "hazme shorts de este podcast", "corta esto en clips", "los mejores momentos para TikTok/Reels/Shorts". Do not use it for a music video (that is videoclip-musical), for a livestream recording (livestream-to-clips), or for a single loose clip (find_highlights).
---

# Shorts virales desde un vídeo largo

This is the OpusClip-shaped pipeline, composed from tools that already exist. Use it when the
user asks to convert one long source into several publishable vertical clips.

## Before anything: is this the right skill?

- **Yes:** one long source (podcast, interview, class, webinar, talk) and a request for
  *clips, shorts, reels, tik-toks, highlights, best moments*.
- **No:** a music video (`videoclip-musical`), a livestream recording
  (`livestream-to-clips`), several raw clips with no dominant source (`multi-clips-to-reels`),
  or one specific moment the user already named (`find_highlights`).

## The pipeline

1. **Transcript.** `transcribe_track` on the source if it has none. Nothing below works
   without word-level timings. If the transcript is stale or partial, say so instead of
   scoring garbage.
2. **Score before cutting.** `score_moments` with the user's own words in `direction`
   ("lo más divertido", "the part about pricing") and the right `genre` when known. Show the
   list: score, the four sub-scores, the reason and the risks. **Say out loud that it is a
   rubric, not a prediction.** Pass `calibration: true` if the project already has decisions.
3. **Cut.** `make_shorts` with `minScore` from what the user accepted, `count`,
   `minSeconds`/`maxSeconds`, `captionsPreset`, and `applyBrandKit: true` when the project has
   a kit. Pass `ranges` when the user picked specific moments — never re-pick for them.
4. **Tighten.** `tighten_speech` returns a review list; apply only after the user approves.
   Same for `censor_words`.
5. **Package.** `write_clip_title` for the headline (propose with `apply: false` first if the
   style is not established), `emphasize_keywords` for numbers and names.
6. **Review renders.** `track_export` on the `renderIds` `make_shorts` returned. Do not report
   a finished clip from a queued job.
7. **Publish or schedule.** `write_social_copy` for title/description/hashtags per platform,
   then `publish_to_social` preview → show it → confirm with `previewId`. For later,
   `schedule_publish` with `when` (ISO with offset) and that same `previewId`.
8. **Close the loop.** After the batch has data, `score_performance` with the platform CSV
   says whether the score agreed with the audience; `calibrate_scores` shows the weights.

## Gates you must respect

- **Review first for anything destructive:** `tighten_speech` and `censor_words` edit the
  source; the first call is always the list.
- **Publishing is public and irreversible:** preview → human approval → confirm. Scheduling
  does not skip that; the server refuses a `previewId` that does not match the approved post.
- **One tool call = one undo step.** Do not chain edits inside a single tool to save calls.
- **Report what you actually verified.** A queued render is not a finished clip, and a rubric
  score is not a promise of views.

## Needs an editor tab

`auto_reframe` (pixel sampling) and any render. Without a tab, `make_shorts` still cuts and
returns `reframe: 'skipped'` with a note — say that instead of claiming the clips were
reframed.

## What to leave the user with

The chosen moments and why, the score of each clip, what was tightened or censored, where the
renders are, what is scheduled and when, and the one thing to review first.
