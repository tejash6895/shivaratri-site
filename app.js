/**
 * ═══════════════════════════════════════════════════════════
 * JAGARANA WITH SHIVA — Application Logic
 * A quiet digital companion for Maha Shivaratri
 * ═══════════════════════════════════════════════════════════
 */

// ─── CONFIGURATION ───
const STORAGE_KEY = 'jagarana_v1';
const CURRENT_VERSION = 2;
const TOTAL_BEADS = 108;
const TOTAL_MALAS = 4;
const COOLDOWN_SECONDS = 30;
const TELEGRAM_LINK = ''; // Set your Telegram group URL here

// TODO Phase 2: Supabase community backend
// const SUPABASE_URL = '';
// const SUPABASE_ANON_KEY = '';

/* ═══ STATE MODULE ═══ */
const State = (() => {
  const defaults = () => ({
    version: CURRENT_VERSION,
    beads: new Array(TOTAL_BEADS).fill(false),
    malaCount: 0,
    totalTaps: 0,
    reflectionsUsed: [],
    quizAttempted: false,
    quizAnswered: [],
    meditationDone: false,
    meditationElapsed: 0,
    midnightDone: false,
    midnightTriggered: false,
    lastSaved: new Date().toISOString(),
    soundEnabled: false, // Opt-in audio for Safari/autoplay safety
  });

  let data = defaults();
  let storageAvailable = true;

  function intInRange(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    const n = Math.floor(value);
    return n < min || n > max ? fallback : n;
  }

  function boolArrayOfLength(value, length, fallback) {
    if (!Array.isArray(value) || value.length !== length) return fallback;
    return value.map(Boolean);
  }

  function stringArray(value, maxItems = 200) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => typeof item === 'string' && item.length > 0)
      .slice(0, maxItems);
  }

  function sanitizeState(parsed) {
    const fresh = defaults();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fresh;

    fresh.beads = boolArrayOfLength(parsed.beads, TOTAL_BEADS, fresh.beads);
    fresh.malaCount = intInRange(parsed.malaCount, 0, TOTAL_MALAS, 0);
    fresh.totalTaps = intInRange(parsed.totalTaps, 0, 1000000, 0);
    fresh.reflectionsUsed = stringArray(parsed.reflectionsUsed);
    fresh.quizAttempted = Boolean(parsed.quizAttempted);
    fresh.quizAnswered = stringArray(parsed.quizAnswered);
    fresh.meditationDone = Boolean(parsed.meditationDone);
    fresh.meditationElapsed = intInRange(parsed.meditationElapsed, 0, 24 * 60 * 60, 0);
    fresh.midnightDone = Boolean(parsed.midnightDone);
    fresh.midnightTriggered = Boolean(parsed.midnightTriggered);
    fresh.lastSaved = typeof parsed.lastSaved === 'string' ? parsed.lastSaved : fresh.lastSaved;
    fresh.soundEnabled = typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : false;
    return fresh;
  }

  function checkStorage() {
    try {
      localStorage.setItem('__test__', '1');
      localStorage.removeItem('__test__');
      return true;
    } catch { return false; }
  }

  function load() {
    storageAvailable = checkStorage();
    if (!storageAvailable) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      data = sanitizeState(parsed);
    } catch (e) {
      console.warn('Corrupt state, starting fresh:', e);
      data = defaults();
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }

  function save() {
    if (!storageAvailable) return;
    data.lastSaved = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      if (e && e.name === 'QuotaExceededError') {
        console.warn('Storage full.');
      } else {
        storageAvailable = false;
      }
    }
  }

  function reset() { data = defaults(); save(); }
  function hasProgress() { return data.malaCount > 0 || data.totalTaps > 0; }

  return { load, save, reset, hasProgress, get: () => data, isStorageAvailable: () => storageAvailable };
})();

/* ═══ AUDIO MODULE ═══ */
const SoundManager = (() => {
  let tapSound = null;
  let bellSound = null;
  let enabled = false;
  let audioReady = false;
  let userInteracted = false;
  let interactionBound = false;

  function init() {
    enabled = Boolean(State.get().soundEnabled);
    updateIcon();
    bindInteractionUnlock();
    if (enabled) ensureAudioReady();
  }

  function bindInteractionUnlock() {
    if (interactionBound) return;
    interactionBound = true;
    const mark = () => { userInteracted = true; };
    document.addEventListener('pointerdown', mark, { passive: true, once: true });
    document.addEventListener('keydown', mark, { once: true });
  }

  function ensureAudioReady() {
    if (audioReady) return;
    try {
      tapSound = new Audio('assets/audio/tap.mp3');
      tapSound.volume = 0.3;
      tapSound.preload = 'none';
      tapSound.onerror = () => { tapSound = null; };

      bellSound = new Audio('assets/audio/bell.mp3');
      bellSound.volume = 0.5;
      bellSound.preload = 'none';
      bellSound.onerror = () => { bellSound = null; };

      audioReady = true;
    } catch {
      tapSound = null;
      bellSound = null;
      audioReady = false;
    }
  }

  function toggle() {
    enabled = !enabled;
    if (enabled) ensureAudioReady();
    userInteracted = true;
    State.get().soundEnabled = enabled;
    State.save();
    updateIcon();
  }

  function updateIcon() {
    const on = document.querySelector('.icon-sound-on');
    const off = document.querySelector('.icon-sound-off');
    if (on) on.style.display = enabled ? 'block' : 'none';
    if (off) off.style.display = enabled ? 'none' : 'block';
    const toggleBtn = document.getElementById('soundToggle');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', enabled ? 'Disable sound' : 'Enable sound');
      toggleBtn.setAttribute('title', enabled ? 'Disable sound' : 'Enable sound');
      toggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }
  }

  function play(sound) {
    if (!enabled || !sound || !userInteracted) return;
    try {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    } catch {}
  }

  function vibrate() { try { navigator.vibrate && navigator.vibrate(15); } catch {} }

  return {
    init, toggle, vibrate,
    playTap: () => play(tapSound),
    playBell: () => play(bellSound),
    isEnabled: () => enabled,
  };
})();

/* ═══ MALA MODULE ═══ */
const Mala = (() => {
  let tapOrderMode = true;
  let cooldownInterval = null;
  let hintTimer = null;
  const MILESTONES = {
    27: 'Quarter done — breathe.',
    54: 'Halfway — stay present.',
    81: 'Three quarters — almost there.',
    108: '108 — Mala complete.',
  };

  function init() {
    renderBeads();
    updateDisplay();
    const toggle = document.getElementById('tapOrderToggle');
    if (toggle) toggle.addEventListener('change', (e) => {
      tapOrderMode = e.target.checked;
      renderBeads();
    });
  }

  function renderBeads() {
    const grid = document.getElementById('beadGrid');
    if (!grid) return;
    const state = State.get();
    grid.innerHTML = '';
    const tappedCount = state.beads.filter(Boolean).length;

    for (let i = 0; i < TOTAL_BEADS; i++) {
      const bead = document.createElement('button');
      bead.className = 'bead';
      bead.setAttribute('role', 'gridcell');
      bead.setAttribute('aria-label', `Bead ${i + 1} of 108`);
      bead.setAttribute('aria-pressed', String(state.beads[i]));
      bead.dataset.index = i;

      if (state.beads[i]) bead.classList.add('tapped');
      else if (tapOrderMode && i === tappedCount) {
        bead.classList.add('next-bead');
        bead.tabIndex = 0;
      }
      if (state.malaCount >= TOTAL_MALAS) bead.classList.add('disabled');
      grid.appendChild(bead);
    }

    grid.onclick = handleTap;
    grid.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(e); }
    };
  }

  function handleTap(e) {
    const bead = e.target.closest('.bead');
    if (!bead) return;
    const state = State.get();
    const index = parseInt(bead.dataset.index, 10);
    if (!Number.isInteger(index) || index < 0 || index >= TOTAL_BEADS) return;
    if (state.beads[index] || state.malaCount >= TOTAL_MALAS) return;

    const tappedCount = state.beads.filter(Boolean).length;
    if (tapOrderMode && index !== tappedCount) {
      showHint(`Tap bead #${tappedCount + 1} next`);
      return;
    }

    state.beads[index] = true;
    state.totalTaps++;
    State.save();

    bead.classList.add('tapped');
    bead.setAttribute('aria-pressed', 'true');

    const newCount = tappedCount + 1;
    if (newCount % 27 === 0) SoundManager.playBell();
    else SoundManager.playTap();
    SoundManager.vibrate();

    if (MILESTONES[newCount]) showMsg('milestoneMsg', MILESTONES[newCount], 3000);

    if (tapOrderMode && newCount < TOTAL_BEADS) {
      const next = document.querySelector(`.bead[data-index="${newCount}"]`);
      if (next) { next.classList.add('next-bead'); next.tabIndex = 0; next.focus(); }
    }
    clearHint();
    updateDisplay();

    if (newCount === TOTAL_BEADS) completeMala();
  }

  function completeMala() {
    const state = State.get();
    state.malaCount++;
    state.beads = new Array(TOTAL_BEADS).fill(false);
    State.save();
    showCompleteOverlay();
    updateDisplay();
    UI.updatePrahar();
    UI.updateCertChecklist();
  }

  function showCompleteOverlay() {
    const overlay = document.getElementById('malaCompleteOverlay');
    const btn = document.getElementById('continueAfterMala');
    const cd = document.getElementById('cooldownTimer');
    if (!overlay) return;
    if (cooldownInterval) clearInterval(cooldownInterval);
    overlay.style.display = 'flex';
    if (btn) btn.style.display = 'none';

    let rem = COOLDOWN_SECONDS;
    if (cd) cd.textContent = rem + 's';
    cooldownInterval = setInterval(() => {
      rem--;
      if (cd) cd.textContent = rem > 0 ? rem + 's' : '';
      if (rem <= 0) {
        clearInterval(cooldownInterval);
        if (btn) btn.style.display = 'inline-flex';
      }
    }, 1000);
  }

  function dismissOverlay() {
    const overlay = document.getElementById('malaCompleteOverlay');
    if (overlay) overlay.style.display = 'none';
    if (cooldownInterval) clearInterval(cooldownInterval);
    Reflection.show();

    const state = State.get();
    const nextBtn = document.getElementById('nextMalaBtn');
    if (nextBtn) nextBtn.style.display = state.malaCount >= TOTAL_MALAS ? 'none' : 'inline-flex';
    renderBeads();
    App.scrollToSection('reflection');
  }

  function startNext() {
    const state = State.get();
    if (state.malaCount >= TOTAL_MALAS) return;
    const nextBtn = document.getElementById('nextMalaBtn');
    if (nextBtn) nextBtn.style.display = 'none';
    renderBeads();
    updateDisplay();
    App.scrollToSection('mala');
  }

  function resetCurrent() {
    if (!confirm('Reset current 108 beads? Completed malas are safe.')) return;
    State.get().beads = new Array(TOTAL_BEADS).fill(false);
    State.save();
    renderBeads();
    updateDisplay();
  }

  function updateDisplay() {
    const state = State.get();
    const tapped = state.beads.filter(Boolean).length;
    setText('beadCounter', `${tapped}/${TOTAL_BEADS}`);
    setText('currentPrahar', String(Math.min(state.malaCount + 1, TOTAL_MALAS)));
    setText('currentMalaNum', String(Math.min(state.malaCount + 1, TOTAL_MALAS)));
  }

  function showMsg(id, msg, duration) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = '1';
    if (duration) setTimeout(() => { el.style.opacity = '0.6'; }, duration);
  }

  function showHint(msg) {
    const el = document.getElementById('tapHint');
    if (!el) return;
    if (hintTimer) clearTimeout(hintTimer);
    el.textContent = msg;
    hintTimer = setTimeout(() => { el.textContent = ''; }, 2000);
  }
  function clearHint() {
    const el = document.getElementById('tapHint');
    if (el) el.textContent = '';
  }

  return { init, renderBeads, resetCurrent, startNext, dismissOverlay, updateDisplay };
})();
/* ═══ REFLECTION MODULE ═══ */
const Reflection = (() => {
  const PROMPTS = [
    { id:'r01', prompt:'Shiva sits in stillness atop Mount Kailash.', meaning:'True strength is found not in action, but in the ability to be still.', source:'Shiva Purana' },
    { id:'r02', prompt:'The river Ganga flows from Shiva\'s matted locks.', meaning:'Even the mightiest forces can be tamed with patience and grace.', source:'Skanda Purana' },
    { id:'r03', prompt:'Shiva\'s third eye sees beyond illusion.', meaning:'Wisdom is seeing the world as it truly is, not as it appears.', source:'Yogic tradition' },
    { id:'r04', prompt:'The crescent moon adorns Shiva\'s head.', meaning:'Embrace the cycles of waxing and waning — nothing is permanent.', source:'Linga Purana' },
    { id:'r05', prompt:'Shiva wears a garland of snakes without fear.', meaning:'When you befriend what frightens you, it becomes your ornament.', source:'Shiva Purana' },
    { id:'r06', prompt:'The ashes on Shiva\'s body remind us of what remains.', meaning:'All material things reduce to nothing. What endures is consciousness.', source:'Advaita Vedanta' },
    { id:'r07', prompt:'Shiva is called Neelakantha — the blue-throated one.', meaning:'Sometimes the greatest act of love is to absorb pain so others may be free.', source:'Samudra Manthan' },
    { id:'r08', prompt:'Nandi sits in eternal devotion before Shiva.', meaning:'True devotion is not an act — it is a way of being.', source:'Shaiva Agamas' },
    { id:'r09', prompt:'Shiva dances the Tandava at the end of ages.', meaning:'Destruction is not an ending — it is the clearing that precedes creation.', source:'Nataraja symbolism' },
    { id:'r10', prompt:'The damaru drum beats the rhythm of creation.', meaning:'The universe begins with sound. Your words carry the power to create.', source:'Nada Brahma tradition' },
    { id:'r11', prompt:'Shiva sits as Dakshinamurti, teaching in silence.', meaning:'The deepest truths cannot be spoken — they are transmitted through presence.', source:'Dakshinamurti Stotra' },
    { id:'r12', prompt:'Ardhanarishvara: Shiva is half himself, half Shakti.', meaning:'Wholeness comes from integrating all aspects of yourself.', source:'Linga Purana' },
    { id:'r13', prompt:'Shiva is the lord of yogis — Adiyogi.', meaning:'The body is not an obstacle to the spirit; it is the instrument of awakening.', source:'Yogic tradition' },
    { id:'r14', prompt:'Shiva wanders as a mendicant, owning nothing.', meaning:'Freedom is not having everything — it is needing nothing.', source:'Shaiva tradition' },
    { id:'r15', prompt:'The trident represents sattva, rajas, and tamas.', meaning:'Mastery is not eliminating qualities but balancing them with awareness.', source:'Samkhya philosophy' },
    { id:'r16', prompt:'Shiva meditates in the burning ground.', meaning:'Sit with impermanence. What you cannot avoid, transform into sacred ground.', source:'Tantric tradition' },
    { id:'r17', prompt:'Mount Kailash is unreachable, yet seekers journey toward it.', meaning:'The goal is the practice, not the arrival.', source:'Pilgrimage tradition' },
    { id:'r18', prompt:'Shiva reduced Kama to ashes with a glance.', meaning:'Desire is not destroyed by suppression but by the fire of awareness.', source:'Shiva Purana' },
    { id:'r19', prompt:'The Rudraksha bead is born from Shiva\'s tear of compassion.', meaning:'Compassion is not weakness — it is the deepest form of strength.', source:'Padma Purana' },
    { id:'r20', prompt:'Shiva accepts all offerings — even water and leaves.', meaning:'Devotion is measured not by grandeur but by sincerity.', source:'Bilva tradition' },
    { id:'r21', prompt:'The lingam represents the formless taking form.', meaning:'The infinite chooses to express itself through the finite — and so do you.', source:'Shaiva Siddhanta' },
    { id:'r22', prompt:'Shiva stands on Apasmara — the demon of ignorance.', meaning:'Ignorance is not defeated once — it must be held down with continuous awareness.', source:'Nataraja iconography' },
    { id:'r23', prompt:'Shiva is Mahadeva — yet he lives simply.', meaning:'Greatness is not in accumulation but in what you can release.', source:'Puranic tradition' },
    { id:'r24', prompt:'Parvati\'s devotion moved even the immovable Shiva.', meaning:'Patience and love can reach what force never will.', source:'Shiva Purana' },
    { id:'r25', prompt:'His throat holds poison, his head holds the moon.', meaning:'One can carry both darkness and light without being defined by either.', source:'Samudra Manthan' },
    { id:'r26', prompt:'Shiva taught 112 meditation techniques to Devi.', meaning:'There is not one path to stillness — there are as many paths as there are seekers.', source:'Vigyana Bhairava Tantra' },
    { id:'r27', prompt:'The river that leaves the mountain must travel through valleys.', meaning:'Difficulty is not a sign of wrong direction — it is part of the terrain.', source:'Himalayan wisdom' },
    { id:'r28', prompt:'Om Namah Shivaya: I bow to the divine within.', meaning:'The deity you seek outside is the awareness already alive inside you.', source:'Shaiva mantra tradition' },
  ];

  function show() {
    const state = State.get();
    const card = document.getElementById('reflectionCard');
    const subtitle = document.getElementById('reflectionSubtitle');
    if (!card) return;

    const unused = PROMPTS.filter(p => !state.reflectionsUsed.includes(p.id));
    const pool = unused.length > 0 ? unused : PROMPTS;
    const prompt = pool[Math.floor(Math.random() * pool.length)];

    if (!state.reflectionsUsed.includes(prompt.id)) {
      state.reflectionsUsed.push(prompt.id);
      State.save();
    }

    document.getElementById('reflectionPrompt').textContent = prompt.prompt;
    document.getElementById('reflectionMeaning').textContent = prompt.meaning;
    document.getElementById('reflectionSource').textContent = '— ' + prompt.source;
    card.style.display = 'block';
    if (subtitle) subtitle.textContent = `${state.reflectionsUsed.length} of ${PROMPTS.length} reflections explored.`;
  }

  function next() { show(); }
  return { show, next };
})();

/* ═══ QUIZ MODULE ═══ */
const Quiz = (() => {
  const QUESTIONS = [
    { id:'q01', question:'What is the name of Shiva\'s cosmic dance?', options:['Tandava','Bharatanatyam','Odissi','Kathakali'], correct:0, insight:'The Tandava represents cosmic cycles of creation and dissolution — change is the only constant.' },
    { id:'q02', question:'What does Shiva hold that represents the rhythm of creation?', options:['Conch','Damaru (drum)','Lotus','Chakra'], correct:1, insight:'The damaru\'s two-sided beat symbolizes duality — creation and destruction from the same source.' },
    { id:'q03', question:'Why is Shiva called Neelakantha?', options:['He wears blue','He drank cosmic poison','He has blue eyes','He lives by the ocean'], correct:1, insight:'Shiva held the halahala poison in his throat during the Samudra Manthan, turning it blue to save creation.' },
    { id:'q04', question:'What does the crescent moon on Shiva\'s head symbolize?', options:['Night worship','Cycles of time and renewal','His love for Parvati','Ocean tides'], correct:1, insight:'The waxing and waning moon represents cyclical time and the beauty of impermanence.' },
    { id:'q05', question:'What is Shiva\'s sacred bull called?', options:['Kamadhenu','Nandi','Airavata','Garuda'], correct:1, insight:'Nandi embodies dharma, devotion, and patience — the perfect devotee.' },
    { id:'q06', question:'Which text contains 112 meditation techniques taught by Shiva?', options:['Bhagavad Gita','Yoga Sutras','Vigyana Bhairava Tantra','Upanishads'], correct:2, insight:'This ancient tantra is one of the most practical meditation manuals ever composed.' },
    { id:'q07', question:'What does Shiva\'s third eye represent?', options:['Anger','Inner wisdom','Supernatural power','Immortality'], correct:1, insight:'The third eye sees beyond material illusion into the true nature of reality.' },
    { id:'q08', question:'Where does Shiva meditate?', options:['Mount Meru','Mount Mandara','Mount Kailash','Mount Vindhya'], correct:2, insight:'Mount Kailash is considered where the physical and spiritual worlds meet.' },
    { id:'q09', question:'Which form of Shiva teaches through silence?', options:['Nataraja','Bhairava','Dakshinamurti','Rudra'], correct:2, insight:'As Dakshinamurti, Shiva transmits the highest knowledge without uttering a word.' },
    { id:'q10', question:'What does Ardhanarishvara represent?', options:['Shiva as destroyer','Union of masculine and feminine','Warrior form','Five elements'], correct:1, insight:'Half Shiva, half Parvati — wholeness comes from integrating all aspects of being.' },
    { id:'q11', question:'What are Rudraksha beads said to originate from?', options:['Sacred water','Shiva\'s tears','Parvati\'s necklace','Kailash bark'], correct:1, insight:'Rudraksha means "Rudra\'s eye" — seeds formed from Shiva\'s tears of compassion.' },
    { id:'q12', question:'What does the trishula (trident) symbolize?', options:['Three worlds','Three gunas','Past, present, future','All of the above'], correct:3, insight:'The trishula holds multiple layers — three gunas, three states of consciousness, mastery over all dimensions.' },
    { id:'q13', question:'Which night is most sacred for Shiva worship?', options:['Diwali','Maha Shivaratri','Navaratri','Kartik Purnima'], correct:1, insight:'The Great Night of Shiva — devotees stay awake in meditation and contemplation.' },
    { id:'q14', question:'What does "Om Namah Shivaya" mean?', options:['"Victory to Shiva"','"I bow to the divine within"','"Shiva is greatest"','"Protect us, Shiva"'], correct:1, insight:'This Panchakshari mantra acknowledges the divine consciousness within every being.' },
    { id:'q15', question:'What does the snake around Shiva\'s neck symbolize?', options:['Danger','Mastery over fear and ego','Royal power','Time'], correct:1, insight:'The serpent represents kundalini energy and mastery over fear.' },
    { id:'q16', question:'Why does Shiva smear ashes (vibhuti) on his body?', options:['For warmth','Reminder of impermanence','To look fierce','For healing'], correct:1, insight:'Ashes symbolize the ultimate truth — all material form returns to formlessness.' },
  ];

  let currentIndex = 0;

  function init() {
    const state = State.get();
    // Find first unanswered question
    currentIndex = QUESTIONS.findIndex(q => !state.quizAnswered.includes(q.id));
    if (currentIndex === -1) currentIndex = 0;
    renderQuestion();
  }

  function renderQuestion() {
    const q = QUESTIONS[currentIndex];
    if (!q) return;
    const state = State.get();
    const answered = state.quizAnswered.includes(q.id);

    setText('quizQuestion', q.question);
    setText('quizProgress', `Question ${currentIndex + 1} of ${QUESTIONS.length}`);

    const optionsEl = document.getElementById('quizOptions');
    const feedbackEl = document.getElementById('quizFeedback');
    const nextBtn = document.getElementById('quizNextBtn');
    if (!optionsEl || !feedbackEl || !nextBtn) return;

    optionsEl.innerHTML = '';
    feedbackEl.style.display = 'none';
    nextBtn.style.display = 'none';

    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.textContent = opt;
      btn.setAttribute('aria-label', opt);

      if (answered) {
        btn.classList.add('disabled');
        if (i === q.correct) btn.classList.add('correct');
      } else {
        btn.addEventListener('click', () => answer(i));
      }
      optionsEl.appendChild(btn);
    });

    if (answered) {
      showFeedback(q, true);
      nextBtn.style.display = 'inline-flex';
    }
  }

  function answer(selected) {
    const q = QUESTIONS[currentIndex];
    const state = State.get();
    const isCorrect = selected === q.correct;

    state.quizAttempted = true;
    if (!state.quizAnswered.includes(q.id)) state.quizAnswered.push(q.id);
    State.save();

    // Mark all options
    const options = document.querySelectorAll('.quiz-option');
    options.forEach((btn, i) => {
      btn.classList.add('disabled');
      if (i === q.correct) btn.classList.add('correct');
      else if (i === selected && !isCorrect) btn.classList.add('incorrect');
    });

    showFeedback(q, isCorrect);
    const nextBtn = document.getElementById('quizNextBtn');
    if (nextBtn) nextBtn.style.display = 'inline-flex';
    UI.updateCertChecklist();
  }

  function showFeedback(q, isCorrect) {
    const el = document.getElementById('quizFeedback');
    if (!el) return;
    el.style.display = 'block';
    el.className = 'quiz-feedback ' + (isCorrect ? 'correct-feedback' : 'incorrect-feedback');
    el.textContent = isCorrect ? '✦ Insight Unlocked: ' + q.insight : 'Not quite — ' + q.insight;
  }

  function next() {
    currentIndex = (currentIndex + 1) % QUESTIONS.length;
    renderQuestion();
  }

  return { init, next };
})();

/* ═══ TIMER MODULE ═══ */
const Timer = (() => {
  let duration = 660; // 11 min default
  let remaining = 660;
  let interval = null;
  let running = false;
  let breathPhase = 0; // 0=inhale, 1=hold, 2=exhale
  let breathInterval = null;
  let lastPersistedCheckpoint = -1;
  const BREATH_CYCLE = [
    { phase: 'inhale', label: 'Breathe in...', duration: 4000, cls: 'inhale' },
    { phase: 'hold', label: 'Hold...', duration: 4000, cls: 'hold' },
    { phase: 'exhale', label: 'Breathe out...', duration: 6000, cls: 'exhale' },
  ];

  function init() {
    const state = State.get();
    if (state.meditationElapsed > 0 && !state.meditationDone) {
      remaining = duration - state.meditationElapsed;
      if (remaining < 0) remaining = 0;
    }
    updateTimerDisplay();
  }

  function setDuration(minutes) {
    if (running) return;
    duration = minutes * 60;
    remaining = duration;
    State.get().meditationDone = false;
    State.get().meditationElapsed = 0;
    State.save();
    updateTimerDisplay();
    // Update active preset button
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.minutes, 10) === minutes);
    });
    const completeEl = document.getElementById('meditationComplete');
    if (completeEl) completeEl.style.display = 'none';
  }

  function toggle() {
    if (running) pause(); else start();
  }

  function start() {
    if (running) return;
    if (remaining <= 0) remaining = duration;
    running = true;
    lastPersistedCheckpoint = -1;
    setText('timerStartBtn', 'Pause');
    const circle = document.getElementById('breathingCircle');
    if (circle) circle.classList.add('active');

    // Show mini timer in header
    const mini = document.getElementById('miniTimer');
    if (mini) mini.style.display = 'block';

    startBreathing();
    const startTime = Date.now();
    const startRemaining = remaining;

    interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const nextRemaining = Math.max(startRemaining - elapsed, 0);
      if (nextRemaining === remaining) return;
      remaining = nextRemaining;
      const elapsedTotal = Math.max(duration - remaining, 0);
      State.get().meditationElapsed = elapsedTotal;
      if (elapsedTotal > 0 && elapsedTotal % 10 === 0 && elapsedTotal !== lastPersistedCheckpoint) {
        State.save();
        lastPersistedCheckpoint = elapsedTotal;
      }

      if (remaining <= 0) {
        remaining = 0;
        complete();
        return;
      }
      updateTimerDisplay();
    }, 1000);
  }

  function pause() {
    if (!running && !interval) return;
    running = false;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    stopBreathing();
    setText('timerStartBtn', 'Start');
    State.get().meditationElapsed = duration - remaining;
    State.save();
  }

  function reset() {
    pause();
    remaining = duration;
    State.get().meditationElapsed = 0;
    State.get().meditationDone = false;
    State.save();
    updateTimerDisplay();
    setText('breathingText', 'Ready');
    const circle = document.getElementById('breathingCircle');
    if (circle) circle.classList.remove('active', 'inhale', 'hold', 'exhale');
    const mini = document.getElementById('miniTimer');
    if (mini) mini.style.display = 'none';
    const completeEl = document.getElementById('meditationComplete');
    if (completeEl) completeEl.style.display = 'none';
    UI.updateCertChecklist();
  }

  function complete() {
    pause();
    State.get().meditationDone = true;
    State.get().meditationElapsed = duration;
    State.save();
    SoundManager.playBell();
    const completeEl = document.getElementById('meditationComplete');
    if (completeEl) completeEl.style.display = 'block';
    const mini = document.getElementById('miniTimer');
    if (mini) mini.style.display = 'none';
    UI.updateCertChecklist();
  }

  function startBreathing() {
    breathPhase = 0;
    runBreathPhase();
  }

  function runBreathPhase() {
    if (!running) return;
    const cycle = BREATH_CYCLE[breathPhase];
    const circle = document.getElementById('breathingCircle');
    setText('breathingText', cycle.label);
    if (circle) {
      circle.classList.remove('inhale', 'hold', 'exhale');
      circle.classList.add(cycle.cls);
    }
    breathInterval = setTimeout(() => {
      breathPhase = (breathPhase + 1) % 3;
      runBreathPhase();
    }, cycle.duration);
  }

  function stopBreathing() {
    clearTimeout(breathInterval);
    breathInterval = null;
  }

  function updateTimerDisplay() {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const str = `${mins}:${secs.toString().padStart(2, '0')}`;
    setText('timerDisplay', str);
    setText('miniTimerText', str);
  }

  return { init, setDuration, toggle, start, pause, reset };
})();

/* ═══ MIDNIGHT MODULE ═══ */
const Midnight = (() => {
  let timer = null;
  let remaining = 300; // 5 min
  let interval = null;
  let running = false;

  function init() {
    const state = State.get();
    if (state.midnightTriggered) return;
    // Check every 30 seconds
    timer = setInterval(checkMidnight, 30000);
    checkMidnight();
  }

  function checkMidnight() {
    const now = new Date();
    const state = State.get();
    if (state.midnightTriggered) { clearInterval(timer); return; }
    if (now.getHours() === 0 && now.getMinutes() < 15) {
      trigger();
    }
  }

  function trigger() {
    const state = State.get();
    state.midnightTriggered = true;
    State.save();
    clearInterval(timer);
    SoundManager.playBell();
    const overlay = document.getElementById('midnightOverlay');
    if (overlay) overlay.style.display = 'flex';
    setText('midnightTimer', '5:00');
  }

  function start() {
    if (running) return;
    remaining = 300;
    running = true;
    setText('midnightStartBtn', 'In stillness...');
    const startBtn = document.getElementById('midnightStartBtn');
    if (startBtn) startBtn.disabled = true;
    setText('midnightTimer', '5:00');

    const startTime = Date.now();
    interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      remaining = 300 - elapsed;
      if (remaining <= 0) { remaining = 0; completeMidnight(); return; }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      setText('midnightTimer', `${m}:${s.toString().padStart(2, '0')}`);
    }, 1000);
  }

  function completeMidnight() {
    if (interval) clearInterval(interval);
    interval = null;
    running = false;
    const state = State.get();
    state.midnightDone = true;
    state.meditationDone = true;
    State.save();
    SoundManager.playBell();
    const overlay = document.getElementById('midnightOverlay');
    if (overlay) overlay.style.display = 'none';
    const startBtn = document.getElementById('midnightStartBtn');
    if (startBtn) startBtn.disabled = false;
    UI.updateCertChecklist();
  }

  function dismiss() {
    const overlay = document.getElementById('midnightOverlay');
    if (overlay) overlay.style.display = 'none';
    if (interval) clearInterval(interval);
    interval = null;
    running = false;
    const startBtn = document.getElementById('midnightStartBtn');
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = 'Enter Stillness';
    }
  }

  return { init, start, dismiss };
})();

/* ═══ CERTIFICATE MODULE ═══ */
const Certificate = (() => {
  let jsPDFLoaded = false;
  let jsPDFLoading = false;
  let jsPDFLoadTimeout = null;
  let jsPDFQueue = [];

  function isUnlocked() {
    const s = State.get();
    return s.malaCount >= TOTAL_MALAS && s.quizAttempted && (s.meditationDone || s.midnightDone);
  }

  function sanitizeLine(input, maxLen) {
    if (typeof input !== 'string') return '';
    return input
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, maxLen);
  }

  function setStatus(msg) {
    const status = document.getElementById('certStatus');
    if (!status) return;
    status.textContent = msg || '';
    status.style.display = msg ? 'block' : 'none';
  }

  function generate() {
    const nameInput = document.getElementById('certName');
    const gotraInput = document.getElementById('certGotra');
    const name = sanitizeLine(nameInput ? nameInput.value : '', 50);
    if (!name || name.length < 2) { alert('Please enter your name (at least 2 characters).'); return; }
    const gotra = sanitizeLine(gotraInput ? gotraInput.value : '', 30);
    if (nameInput) nameInput.value = name;
    if (gotraInput) gotraInput.value = gotra;
    setStatus('');

    const state = State.get();
    const date = new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' });
    const certId = 'JSV-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(16).slice(2,8).toUpperCase();
    const meditationStatus = state.midnightDone ? 'Midnight stillness complete' : 'Meditation complete';
    const stats = `108 × 4 = 432 beads | ${state.reflectionsUsed.length} reflections | ${meditationStatus}`;
    const gotraLine = gotra ? ` of ${gotra}` : '';

    // Try jsPDF first, fall back to print
    if (!jsPDFLoaded) {
      loadJsPDF(() => {
        if (jsPDFLoaded) buildPDF(name, gotraLine, date, certId, stats);
        else buildPrintFallback(name, gotraLine, date, certId, stats);
      });
    } else {
      buildPDF(name, gotraLine, date, certId, stats);
    }
  }

  function loadJsPDF(callback) {
    if (jsPDFLoaded || (window.jspdf && window.jspdf.jsPDF)) {
      jsPDFLoaded = true;
      callback();
      return;
    }

    jsPDFQueue.push(callback);
    if (jsPDFLoading) return;
    jsPDFLoading = true;

    const finish = (loaded) => {
      if (jsPDFLoadTimeout) {
        clearTimeout(jsPDFLoadTimeout);
        jsPDFLoadTimeout = null;
      }
      jsPDFLoaded = Boolean(loaded && window.jspdf && window.jspdf.jsPDF);
      jsPDFLoading = false;
      const queued = jsPDFQueue;
      jsPDFQueue = [];
      queued.forEach((cb) => {
        try { cb(); } catch {}
      });
    };

    const existing = document.querySelector('script[data-jspdf-loader="true"]');
    if (existing) {
      existing.addEventListener('load', () => finish(true), { once: true });
      existing.addEventListener('error', () => finish(false), { once: true });
      jsPDFLoadTimeout = setTimeout(() => finish(false), 7000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.dataset.jspdfLoader = 'true';
    script.onload = () => { finish(true); };
    script.onerror = () => { finish(false); };
    jsPDFLoadTimeout = setTimeout(() => finish(false), 7000);
    document.head.appendChild(script);
  }

  function buildPDF(name, gotraLine, date, certId, stats) {
    try {
      if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF unavailable');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();

      // Background
      doc.setFillColor(15, 15, 35);
      doc.rect(0, 0, w, h, 'F');

      // Gold border
      doc.setDrawColor(212, 168, 67);
      doc.setLineWidth(0.8);
      doc.rect(10, 10, w - 20, h - 20);
      doc.rect(13, 13, w - 26, h - 26);

      // Om watermark
      doc.setFontSize(120);
      doc.setTextColor(212, 168, 67, 15);
      doc.text('\u0950', w / 2, h / 2 + 20, { align: 'center' });

      // Trident symbol
      doc.setFontSize(28);
      doc.setTextColor(212, 168, 67);
      doc.text('\uD83D\uDD31', w / 2, 32, { align: 'center' });

      // Title
      doc.setFontSize(28);
      doc.setTextColor(232, 230, 240);
      doc.text('Jagarana Certificate', w / 2, 48, { align: 'center' });

      // Divider
      doc.setDrawColor(212, 168, 67);
      doc.setLineWidth(0.3);
      doc.line(w / 2 - 40, 53, w / 2 + 40, 53);

      // Body text
      doc.setFontSize(12);
      doc.setTextColor(200, 198, 210);
      const body = `This is to honor that ${name}${gotraLine} completed the Four Prahar Jagarana on Maha Shivaratri ${date}, having meditated, reflected, and kept the sacred night vigil.`;
      const lines = doc.splitTextToSize(body, w - 80);
      doc.text(lines, w / 2, 68, { align: 'center' });

      // Stats
      doc.setFontSize(9);
      doc.setTextColor(154, 151, 176);
      doc.text(stats, w / 2, 100, { align: 'center' });

      // Certificate ID
      doc.setFontSize(8);
      doc.text(certId, w / 2, 110, { align: 'center' });

      // Closing
      doc.setFontSize(14);
      doc.setTextColor(212, 168, 67);
      doc.text('\u0950 \u0928\u092E\u0903 \u0936\u093F\u0935\u093E\u092F  |  Om Namah Shivaya', w / 2, h - 25, { align: 'center' });

      doc.save(`Jagarana-Certificate-${certId}.pdf`);
      setStatus('Certificate downloaded as PDF.');
      showShareBtn();
    } catch (e) {
      console.error('PDF generation failed:', e);
      setStatus('PDF library unavailable. Opening print-friendly fallback.');
      buildPrintFallback(name, gotraLine, date, certId, stats);
    }
  }

  function buildPrintFallback(name, gotraLine, date, certId, stats) {
    setText('certPrintName', name);
    const gotraEl = document.getElementById('certPrintGotra');
    if (gotraEl) gotraEl.textContent = gotraLine;
    setText('certPrintDate', date);
    setText('certPrintStats', stats);
    setText('certPrintId', certId);
    try {
      window.print();
      setStatus('Print fallback opened. Use "Save as PDF" from the print dialog if needed.');
    } catch {
      setStatus('Print fallback is unavailable in this browser.');
    }
    showShareBtn();
  }

  function share() {
    const state = State.get();
    const date = new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' });
    const text = `I completed the Four Prahar Jagarana on ${date}! 432 beads, ${state.reflectionsUsed.length} reflections, and meditation in stillness. Om Namah Shivaya \uD83D\uDE4F #MahaShivaratri #Jagarana`;
    try {
      navigator.clipboard.writeText(text);
      alert('Sharing text copied to clipboard!');
    } catch {
      prompt('Copy this text to share:', text);
    }
  }

  function showShareBtn() {
    const el = document.getElementById('certShare');
    if (el) el.style.display = 'block';
  }

  return { isUnlocked, generate, share };
})();

/* ═══ COMMUNITY MODULE ═══ */
const Community = (() => {
  function sanitizeExternalUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      const parsed = new URL(rawUrl, window.location.href);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
    } catch {}
    return '';
  }

  function init() {
    // Set up Telegram link if configured
    const safeLink = sanitizeExternalUrl(TELEGRAM_LINK);
    if (safeLink) {
      const container = document.getElementById('telegramLink');
      const anchor = document.getElementById('telegramAnchor');
      if (container && anchor) {
        anchor.href = safeLink;
        container.style.display = 'block';
      }
    }
  }

  function copyMantra() {
    const input = document.getElementById('mantraInput');
    const text = input ? input.value.trim() : '';
    const mantra = text || 'Om Namah Shivaya \uD83D\uDE4F';
    try {
      navigator.clipboard.writeText(mantra);
      alert('Blessing copied!');
    } catch {
      prompt('Copy your blessing:', mantra);
    }
  }

  return { init, copyMantra };
})();

/* ═══ UI MODULE ═══ */
const UI = (() => {
  function init() {
    updatePrahar();
    updateCertChecklist();
    updateContinueBtn();
    initScrollHeader();
  }

  function updatePrahar() {
    const state = State.get();
    document.querySelectorAll('.prahar-dot').forEach((dot, i) => {
      dot.classList.remove('completed', 'current');
      if (i < state.malaCount) dot.classList.add('completed');
      else if (i === state.malaCount && state.malaCount < TOTAL_MALAS) dot.classList.add('current');
    });
  }

  function updateCertChecklist() {
    const state = State.get();
    const malaReq = document.getElementById('reqMala');
    const quizReq = document.getElementById('reqQuiz');
    const medReq = document.getElementById('reqMeditation');

    if (malaReq) {
      const done = state.malaCount >= TOTAL_MALAS;
      malaReq.classList.toggle('done', done);
      malaReq.querySelector('.cert-check').textContent = done ? '✓' : '○';
    }
    if (quizReq) {
      const done = state.quizAttempted;
      quizReq.classList.toggle('done', done);
      quizReq.querySelector('.cert-check').textContent = done ? '✓' : '○';
    }
    if (medReq) {
      const done = state.meditationDone || state.midnightDone;
      medReq.classList.toggle('done', done);
      medReq.querySelector('.cert-check').textContent = done ? '✓' : '○';
    }

    // Show/hide cert form
    const form = document.getElementById('certForm');
    const checklist = document.getElementById('certChecklist');
    if (Certificate.isUnlocked()) {
      if (form) form.style.display = 'block';
      if (checklist) checklist.style.display = 'none';
    } else {
      if (form) form.style.display = 'none';
      if (checklist) checklist.style.display = 'block';
    }
  }

  function updateContinueBtn() {
    const btn = document.getElementById('continueBtn');
    if (btn) btn.style.display = State.hasProgress() ? 'inline-flex' : 'none';
  }

  function initScrollHeader() {
    // Header blur effect on scroll already handled by CSS backdrop-filter
  }

  return { init, updatePrahar, updateCertChecklist };
})();

/* ═══ APP — Main Controller ═══ */
const App = (() => {
  function init() {
    State.load();
    SoundManager.init();
    Mala.init();
    Quiz.init();
    Timer.init();
    Midnight.init();
    Community.init();
    UI.init();

    // Sound toggle
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) soundToggle.addEventListener('click', SoundManager.toggle);

    // Warn before closing if progress exists
    window.addEventListener('beforeunload', (e) => {
      const state = State.get();
      if (state.totalTaps > 0 && state.malaCount < TOTAL_MALAS) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Storage unavailable warning
    if (!State.isStorageAvailable()) {
      console.warn('Private browsing detected — progress will not persist.');
      showStorageWarning('Private browsing/storage restrictions detected. Progress may not persist after refresh.');
    }
  }

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const header = document.getElementById('site-header');
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const targetY = window.scrollY + el.getBoundingClientRect().top - headerHeight - 12;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  function scrollToCurrent() {
    const state = State.get();
    if (Certificate.isUnlocked()) return scrollToSection('certificate');
    if (state.malaCount >= TOTAL_MALAS) return scrollToSection('meditation');
    if (state.beads.filter(Boolean).length > 0) return scrollToSection('mala');
    if (state.malaCount > 0) return scrollToSection('reflection');
    scrollToSection('mala');
  }

  function resetAll() {
    const modal = document.getElementById('resetModal');
    const input = document.getElementById('resetConfirmInput');
    if (modal) modal.style.display = 'flex';
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  function closeResetModal() {
    const modal = document.getElementById('resetModal');
    if (modal) modal.style.display = 'none';
  }

  function confirmReset() {
    const input = document.getElementById('resetConfirmInput');
    const value = input ? input.value.trim() : '';
    if (value !== 'RESET') { alert('Type RESET to confirm.'); return; }
    State.reset();
    closeResetModal();
    location.reload();
  }

  function showStorageWarning(message) {
    const banner = document.getElementById('storageWarning');
    if (!banner) return;
    const header = document.getElementById('site-header');
    if (header) banner.style.top = `${Math.ceil(header.getBoundingClientRect().height)}px`;
    banner.textContent = message;
    banner.hidden = false;
  }

  return {
    init, scrollToSection, scrollToCurrent, resetAll, closeResetModal, confirmReset,
    Mala, Reflection, Quiz, Timer, Midnight, Certificate, Community,
  };
})();

/* ═══ HELPER ═══ */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ═══ BOOT ═══ */
document.addEventListener('DOMContentLoaded', App.init);
