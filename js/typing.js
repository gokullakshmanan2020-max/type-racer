/* ============================================================
 * TYPE RACER - SPEED RUSH
 * typing.js — typing engine: caret state + live metrics
 * The caret only advances on a correct character; wrong keys
 * are counted as mistakes and must be re-typed correctly.
 * ============================================================ */
window.TR = window.TR || {};

TR.TypingEngine = class TypingEngine {
  constructor(text) {
    this.text = text;
    this.caret = 0;          // index of the next char to type
    this.correct = 0;        // correct keystrokes
    this.wrong = 0;          // wrong keystrokes
    this.wrongNow = false;   // wrong char shown at caret (until corrected)
    this.times = [];         // timestamps of correct keystrokes (rolling WPM)
  }

  get done() { return this.caret >= this.text.length; }

  get currentChar() { return this.text[this.caret]; }

  /* Handle one printable key. Returns 'correct' | 'wrong'. */
  press(key) {
    if (this.done) return "wrong";
    if (key === this.currentChar) {
      this.correct++;
      this.times.push(performance.now());
      this.wrongNow = false;
      this.caret++;
      return "correct";
    }
    this.wrong++;
    this.wrongNow = true;
    return "wrong";
  }

  /* Rolling WPM over the last WPM_WINDOW seconds */
  liveWpm(now) {
    const cutoff = now - TR.Config.WPM_WINDOW * 1000;
    while (this.times.length && this.times[0] < cutoff) this.times.shift();
    const perSec = this.times.length / TR.Config.WPM_WINDOW;
    return Math.round(perSec * 60 / 5);
  }

  /* Final WPM: cumulative chars (incl. mistakes) over total time */
  finalWpm(timeSec) {
    const chars = this.correct + this.wrong;
    return timeSec > 0 ? Math.round(chars / 5 / (timeSec / 60)) : 0;
  }

  accuracy() {
    const total = this.correct + this.wrong;
    return total === 0 ? 100 : Math.round((this.correct / total) * 100);
  }
};
