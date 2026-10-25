---
name: long-video-to-shorts
description: Cut one long podcast, interview, course, livestream, or other source video into social-ready shorts, reels, highlights, or clip timelines from existing project media. Use when the user asks to cut a long video into Shorts, Reels, TikToks, Xiaohongshu posts, best moments, highlights, or multiple clips.
---

# Long Video to Shorts

Use this workflow when one long source video carries the output. Supporting clips may exist, but the short-form story comes from selecting self-contained moments inside the long source.

This is a OpenChatCut-native workflow. Use the current project, assets, transcript, timeline, and OpenChatCut editing tools. Do not depend on external download, transcription, ffmpeg, or auto-crop pipelines unless the user explicitly asks for an external source that is not already in the project.

## Tools for this pipeline (Plan 5)

Loading this skill reveals these tools. They are the Opus-style pipeline, and they compose:
`make_shorts` calls the same engine as `score_moments`, so a score you saw once is the score
that gets cut.

1. `transcribe_track` — nothing below works without a word-level transcript.
2. `score_moments` — rank candidates 0-99 before cutting anything. It is a rubric, not a
   prediction: read `subscores`, `reason` and `risks`, and pass the user's own words in
   `direction`. `calibration: true` uses the project's learned weights.
3. `make_shorts` — the one call: score → cut → captions → reframe → optional 480p previews.
   Pass `minScore` from the ranking, `ranges` when the user already picked moments, and
   `applyBrandKit: true` to inherit the project's brand kit.
4. `find_highlights` — a single clip, or a fast cut with `score: false`.
5. `tighten_speech` — fillers, false starts and long pauses. Review list first; `apply: true`
   after the user approves.
6. `censor_words` — the same two-step review, applied as a volume envelope (the clip is not cut).
7. `write_clip_title` — one undoable title clip; `apply: false` to propose the wording.
8. `emphasize_keywords` — numbers, names and shouted words take the caption highlight colour.
9. `write_social_copy` — per-platform title, description and hashtags within each limit; pass
   the chosen ones straight into `publish_to_social`.
10. `publish_to_social` — preview without `confirm`, show it, then confirm with the `previewId`.
    For later, `schedule_publish` with `when` (ISO with offset) and that same `previewId`;
    `list_scheduled_publishes` and `cancel_scheduled_publish` manage the queue.
11. `score_performance` — after publishing, paste the platform CSV to see whether the score
    agreed with the audience; `calibrate_scores` reports the weights it has learned.
12. `apply_brand_kit` — propagate the kit to every sequence.

Read-only: `score_moments`, `calibrate_scores`, `write_social_copy`, `emphasize_keywords` (with
`apply: false`), `list_scheduled_publishes`, `score_performance`. Everything that edits is one
undo step. Reframe and preview renders need an editor tab; the rest runs headless.

## Workflow

1. Read the project state before editing. Identify the primary long video, duration, language, speakers, current timeline, transcript readiness, visual descriptions, and aspect ratio.
2. Confirm that one long source carries the output. If the project is mainly multiple raw clips with no dominant long source, switch to the Multi Clips to Reels workflow.
3. Determine only missing constraints that would change the edit: platform, clip count, target duration, audience, style, captions/title text, music, and whether the user wants options or direct creation.
4. If more than one missing constraint remains, ask for them in one `<widget>` after loading `widget-forms`. Use text fields for open-ended fields like topic, spoken language, audience, or goals; use single/multi choice fields for bounded choices like platform, count, duration, captions, or music.
5. Use transcript ranges when available. If transcription is unavailable or unreliable, inspect visual/audio content and ask only for missing context that changes selection.
6. Scan for moments that can stand alone: clear setup, hook, claim, proof, emotional turn, lesson, conflict, demonstration, or payoff. Read [references/short-form-selection.md](references/short-form-selection.md) when scoring or comparing candidates.
7. Build a compact candidate plan before heavy editing. For each output include source range, opening hook, why it stands alone, payoff, target duration, platform treatment, and risks.
8. If the user gave enough constraints and asked to create directly, proceed after stating the plan. If the source is very long, the request is vague, or the requested count is high, create or preview the first strongest clip before batching the rest.
9. Cut on clean word, phrase, action, or beat boundaries. Tighten filler, false starts, repeated attempts, and dead time only when meaning and tone stay intact.
10. Package for the target platform: aspect ratio/crop, title text, styled captions, music, light motion graphics, zooms, speed changes, or transitions only when they support the selected moment.
11. QA before reporting done: hook in first seconds, clear payoff, standalone clarity, no misleading title, clean boundaries, platform fit, requested count/duration, timeline names, and export readiness.

## Plan Format

When presenting a plan, use this compact shape:

- Clip number/title
- Source range
- Opening hook
- Why it stands alone
- Payoff or viewer value
- Target duration/platform treatment
- Edit notes and risks

When creating clips, report timeline names, durations, packaging applied, assumptions, and what to review first.

## Rules

- Preserve claims, speaker intent, context, and causality. Do not make the speaker appear to say something they did not mean.
- Prefer the smallest range that preserves setup, meaning, and payoff.
- Do not summarize the whole long source evenly.
- Do not choose a quotable line if it needs missing context to make sense.
- Do not use misleading title text to compensate for a weak moment.
- Do not pad with weak clips just to hit the requested count.
- Do not treat a full talking-head polish request as Long Video to Shorts unless the user asks for shorts, clips, highlights, or cutdowns.
- Do not batch many shorts blindly. If the style is not established, create or preview the first strong clip before repeating it.