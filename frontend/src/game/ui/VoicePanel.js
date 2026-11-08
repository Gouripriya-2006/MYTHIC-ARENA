export function renderVoicePanel({ diagnostics = false, showTranscript = true } = {}) {
  return `
    <section class="game-panel voice-panel" aria-labelledby="voice-panel-title">
      <div class="game-panel-heading">
        <span class="game-panel-kicker">VOICE INTERACTION</span>
        <span class="voice-status" data-voice-status data-state="checking-service" role="status" aria-live="polite"><i></i><span data-voice-status-label>CHECKING SERVICE</span></span>
      </div>
      <div class="voice-panel-body">
        <span class="voice-orb" aria-hidden="true">◉</span>
        <div>
          <h2 id="voice-panel-title">Speak to the Game Master.</h2>
          <p data-voice-detail>Checking local voice service…</p>
        </div>
      </div>
      <div class="voice-actions">
        <button class="voice-connect-button" type="button" data-voice-record>
          <span aria-hidden="true">●</span> Start voice input
        </button>
        <button class="voice-cancel-button" type="button" data-voice-stop hidden>Stop &amp; send</button>
        <button class="voice-cancel-button" type="button" data-voice-cancel hidden>Cancel</button>
      </div>
      <div class="voice-services" aria-label="Voice provider configuration">
        <span data-voice-provider="prisma" data-state="checking">PRISMA <b>CHECKING</b></span>
        <span data-voice-provider="groq" data-state="checking">GROQ <b>CHECKING</b></span>
        <span data-voice-provider="timbre" data-state="checking">TIMBRE <b>CHECKING</b></span>
      </div>
      ${showTranscript ? '<p class="voice-transcript-label">RECOGNIZED SPEECH</p><p class="voice-transcript" data-voice-transcript aria-live="polite"></p>' : ''}
      ${diagnostics ? `<details class="voice-diagnostics" data-voice-diagnostics open>
        <summary>TEMPORARY VOICE DIAGNOSTICS</summary>
        <dl>
          <div><dt>Recognized intent</dt><dd data-voice-diagnostic="recognized-intent">Not available</dd></div>
          <div><dt>Validated intent</dt><dd data-voice-diagnostic="validated-intent">Not attempted</dd></div>
          <div><dt>Dispatcher status</dt><dd data-voice-diagnostic="dispatcher-result">NOT ATTEMPTED</dd></div>
          <div><dt>Action result</dt><dd data-voice-diagnostic="last-action-status">NOT ATTEMPTED</dd></div>
          <div><dt>Rejection reason</dt><dd data-voice-diagnostic="rejection-reason">None</dd></div>
        </dl>
      </details>` : ''}
    </section>
  `
}
