/* ============================================================
 * TYPE RACER - SPEED RUSH
 * texts.js — typing content pools per difficulty
 * All texts are single-line (spaces, no newlines) for linear typing.
 * ============================================================ */
window.TR = window.TR || {};

TR.Texts = {
  /* Easy — simple English sentences */
  easy: [
    "The night city glows with electric colors and the streets are alive.",
    "A fast car needs a sharp driver who never looks away from the road.",
    "The race begins when the light turns green and the engines roar.",
    "Speed is nothing without control so keep your eyes on the finish line.",
    "Every champion started as a rookie with a dream and a wheel.",
    "The rain falls on the highway but the race continues at full throttle.",
    "Stay calm, breathe deep, and let your fingers dance on the keys.",
    "The crowd cheers as the neon cars flash past the grand stands.",
    "Focus on the words ahead and do not let a single error slow you down.",
    "The engine hums a sweet song as the wheels grip the warm asphalt.",
    "Victory belongs to those who keep going when the road gets rough.",
    "A quiet mind and quick hands will take you to first place tonight.",
    "The checkered flag waits for the driver who never stops improving.",
    "Turn the music up and let the highway pull you into the night."
  ],

  /* Medium — longer paragraphs */
  medium: [
    "The starting grid hums with tension as drivers grip their steering wheels. Engines rev in unison, filling the air with a deep, rolling thunder. In thirty seconds, a hundred meters of asphalt will separate glory from defeat. You must read the words in front of you with total focus, because every keystroke pushes the needle of your speedometer closer to the red line.",
    "Racing is a game of fractions. A blink of an eye decides who reaches the corner first, and a single hesitation can cost you the podium. The best drivers type their way through chaos without ever breaking their rhythm. When the pressure mounts and your heart beats like a drum, remember that smooth and steady always beats fast and reckless.",
    "The midnight highway stretches ahead like a ribbon of black glass. Street lights blur into streams of gold as your speed climbs higher. With every correct character the world outside grows softer, and the engine's song turns into a symphony. Keep your pace, guard your combo, and the finish line will come to meet you.",
    "Some races are won by raw speed, but most are won by discipline. Your fingers must move faster than your doubts, and your mistakes must never shake your confidence. A true racer accepts every error, learns from it, and returns to the keyboard with sharper focus than before. The road does not care about excuses; it only rewards progress.",
    "The crowd's roar fades behind you as you dive into the night. Ahead, the taillights of your rivals blink like distant stars, teasing you to close the gap. Each word you type is fuel in your tank, each combo a surge of nitro waiting to be unleashed. Stay in the zone and let the momentum carry you across the line.",
    "As the countdown hits zero, every nerve in your body lights up. The tires bite the tarmac and the world becomes a blur of neon. This is the moment you have trained for. Your eyes scan the text, your mind decodes the rhythm, and your hands deliver perfection. Do not look back; the finish line is closer than you think."
  ],

  /* Hard — programming code (single-line, spaces only) */
  hard: [
    "const engine = new Engine({ maxSpeed: 220, nitro: true }); engine.on('boost', (speed) => updateHud(speed)); if (combo >= 30) engine.activateNitro();",
    "function calculateWpm(correctChars, elapsedSeconds) { const minutes = elapsedSeconds / 60; return Math.round(correctChars / 5 / minutes); }",
    "<div class='race-track' data-speed='high'> <span class='car neon'>Player</span> <span class='car ai'>Rival</span> </div>",
    ".speedometer { background: conic-gradient(var(--neon) 0deg, #1a1a2e 0deg); border-radius: 50%; filter: drop-shadow(0 0 12px var(--glow)); }",
    "def nitro_charge(correct, wrong): return min(100, (correct - wrong) * 2.5) if correct > wrong else 0",
    "public class Racer { private int speed = 60; public void typeCorrect() { speed = Math.min(220, speed + 2); } }",
    "select name, best_wpm, best_accuracy from leaderboard where position <= 10 order by best_wpm desc;",
    "#include <stdio.h> int main() { int speed = 60; while (speed < 220) { speed += 2; } printf(\"Finish!\"); return 0; }",
    "const { player, rivals } = useRacingState(); useEffect(() => { if (player.progress >= track.length) endRace(); }, [player.progress]);",
    "function renderCar(ctx, car) { ctx.fillStyle = car.nitro ? '#38f2ff' : car.color; ctx.shadowBlur = car.nitro ? 24 : 8; ctx.fillRect(car.x, car.y, 40, 16); }"
  ],

  /* Daily challenge pool — varied mixed text */
  daily: [
    "Today's mission: beat the clock and leave your rivals in the neon dust.",
    "The daily track changes every sunrise, so bring your fastest fingers.",
    "A perfect run starts with a steady breath and a clear mind tonight.",
    "Push through the doubt and let every correct key pull you forward.",
    "The city never sleeps and neither should your race day focus.",
    "Small corrections make big champions, so keep your combo alive.",
    "One wrong key costs speed, but a brave driver never stops typing.",
    "Finish today's challenge and earn your place on the leaderboard.",
    "The checkered flag is waiting, but only the focused will reach it.",
    "Every race is a story; today yours ends with victory and style."
  ],

  /* Pick a random item from a pool (optionally seeded) */
  pick(pool, seed) {
    const list = TR.Texts[pool] || TR.Texts.medium;
    if (seed === undefined) return list[Math.floor(Math.random() * list.length)];
    return list[Math.floor(TR.rand(seed)() * list.length)];
  }
};
