# Audio integration points

No soundtrack or sound-effects files are bundled. Playback is intentionally not
simulated: the audio preferences panel identifies the missing licensed assets.
Master, music, effects, and mute preferences are saved with the local RPG save.

The future audio manager should load local, licensed files from this directory
and apply those saved channel gains. Suggested asset slots:

- `exploration.ogg`
- `combat.ogg`
- `boss.ogg`
- `ambience.ogg`
- `sword-light.ogg`
- `sword-heavy.ogg`
- `magic.ogg`
- `footsteps.ogg`
- `enemy-attack.ogg`
- `victory.ogg`
- `defeat.ogg`
- `ui.ogg`

Add a per-file license/attribution record before using any downloaded audio.
Do not treat these filenames or the UI controls as evidence that audio playback
is present.
