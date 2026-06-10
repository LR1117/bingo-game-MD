// ─── ROUND DATA ───────────────────────────────────────────────────────────────
const ROUND_DATA = [
  { round: 1,  prize: '$100 Amazon Gift Card',  pattern: 'line',     title: 'Round 1' },
  { round: 2,  prize: '$200 Amazon Gift Card',  pattern: 'corners',  title: 'Round 2' },
  { round: 3,  prize: '$200 Visa Gift Card',    pattern: 'plus',     title: 'Round 3' },
  { round: 4,  prize: '$300 Visa Gift Card',    pattern: 'standing', title: 'Round 4' },
  { round: 5,  prize: '$400 Visa Gift Card',    pattern: 'line',     title: 'Round 5' },
  { round: 6,  prize: 'Mystery Prize',          pattern: 'standing2',title: 'Round 6' },
  { round: 7,  prize: '$500 Visa Gift Card',    pattern: 'corners',  title: 'Round 7' },
  { round: 8,  prize: 'Mystery Round',          pattern: 'block6',   title: 'Round 8' },
  { round: 9,  prize: '$1000 Visa Gift Card',   pattern: 'standing', title: 'Round 9' },
  { round: 10, prize: '$1500 Visa Gift Card',   pattern: 'corners',  title: 'Round 10' },
];

// ─── PATTERN DEFINITIONS ─────────────────────────────────────────────────────
const PATTERNS = {
  'line':     { name: 'Standard Line',       desc: 'Get 5 in a row — horizontally, vertically, or diagonally. The FREE space counts!' },
  'corners':  { name: 'Four Corners',        desc: 'Mark the four corner squares: B1, B15, O1 and O75.' },
  't-shape':  { name: 'T-Shape',             desc: 'Fill the entire top row plus the middle column.' },
  'plus':     { name: 'Plus Sign',           desc: 'Fill the entire middle row AND middle column — forms a + shape.' },
  'x-shape':  { name: 'X-Shape',             desc: 'Mark both diagonals — they form an X across the card.' },
  'frame':    { name: 'Frame',               desc: 'Fill all 16 squares around the outer edge of the card.' },
  'coverall': { name: 'Coverall (Blackout)', desc: 'Mark every single square on your card. Very tough!' },
  'postage':  { name: 'Postage Stamp',       desc: 'Fill the 2×2 square in the top-right corner.' },
  'l-shape':  { name: 'L-Shape',             desc: 'Fill the entire bottom row and entire left column.' },
  'block6':   { name: 'Block of 6',          desc: 'Any 6 squares that form a solid 3×2 or 2×3 block anywhere on the card.' },
  'standing': { name: 'Standing Up Bingo',   desc: 'Everyone stands at the start. When a number on YOUR card is called, you SIT DOWN and are OUT. Last person(s) standing win!' },
  'standing2':{ name: 'Standing Up Bingo v2',desc: 'Everyone stands. You STAY STANDING if you have the called number. You SIT if you do NOT have it. Stay standing as long as your numbers keep getting called.' },
};

// ─── STATE ───────────────────────────────────────────────────────────────────
let mode = 'presenter';
let calledNumbers = [];
let currentPattern = 'line';
let currentRound = 1;
let currentPrize = '$100 Amazon Gift Card';
let currentRoundTitle = 'Round 1';
let isBonusRound = false;
let db = null;
let localMode = false;
let gameRef = null;

// ─── FIREBASE ────────────────────────────────────────────────────────────────
function connectFirebase() {
  const url = (typeof FIREBASE_DATABASE_URL !== 'undefined' && FIREBASE_DATABASE_URL !== 'YOUR_FIREBASE_DATABASE_URL_HERE')
    ? FIREBASE_DATABASE_URL : null;
  if (!url || !url.includes('firebaseio.com')) {
    showToast('⚠️ No Firebase URL — running in local mode.');
    useLocalMode();
    return;
  }
  initFirebase(url);
}

function initFirebase(url) {
  try {
    if (firebase.apps.length > 0) firebase.app().delete().then(() => _initFB(url));
    else _initFB(url);
  } catch(e) { _initFB(url); }
}

function _initFB(url) {
  try {
    const app = firebase.initializeApp({ databaseURL: url }, 'bingo-' + Date.now());
    db = firebase.database(app);
    gameRef = db.ref('bingo_game');
    setupRealtimeListener();
    showMainContent();
    setStatusOnline();
  } catch(e) {
    showToast('Firebase connection failed: ' + e.message);
    useLocalMode();
  }
}

function useLocalMode() {
  localMode = true;
  showMainContent();
  setStatusOffline();
}

function showMainContent() {
  document.getElementById('status-bar').style.display = 'flex';
  initBoard();
  buildPatternSelect();
  renderAll();
  setMode(mode);
}

function setStatusOnline() {
  document.getElementById('status-dot').className = 'status-dot';
  document.getElementById('status-text').textContent = 'Live sync active';
}

function setStatusOffline() {
  document.getElementById('status-dot').className = 'status-dot offline';
  document.getElementById('status-text').textContent = 'Local mode (this device only)';
}

function setupRealtimeListener() {
  gameRef.on('value', snapshot => {
    const data = snapshot.val() || {};
    calledNumbers    = data.called      || [];
    currentPattern   = data.pattern     || 'line';
    currentRound     = data.round       || 1;
    currentPrize     = data.prize       || '$100 Amazon Gift Card';
    currentRoundTitle= data.roundTitle  || 'Round 1';
    isBonusRound     = data.bonusRound  || false;

    // Sync caller UI fields (don't override if user is actively typing)
    const sel = document.getElementById('pattern-select');
    if (sel && sel.value !== currentPattern) sel.value = currentPattern;

    const prizeInput = document.getElementById('prize-input');
    if (prizeInput && document.activeElement !== prizeInput) prizeInput.value = currentPrize;

    const titleInput = document.getElementById('round-title-input');
    if (titleInput && document.activeElement !== titleInput) titleInput.value = currentRoundTitle;

    renderAll();
  }, err => {
    showToast('Sync error: ' + err.message);
    setStatusOffline();
  });
}

// ─── PUSH STATE ───────────────────────────────────────────────────────────────
function pushState() {
  const state = {
    called:      calledNumbers,
    pattern:     currentPattern,
    round:       currentRound,
    prize:       currentPrize,
    roundTitle:  currentRoundTitle,
    bonusRound:  isBonusRound,
  };
  if (localMode || !gameRef) { renderAll(); return; }
  gameRef.set(state);
}

// ─── CALLING NUMBERS ─────────────────────────────────────────────────────────
function getLetter(n) {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
}

function callNumber() {
  const input = document.getElementById('call-input');
  const n = parseInt(input.value);
  if (isNaN(n) || n < 1 || n > 75) { showToast('Please enter a number between 1 and 75.'); return; }
  if (calledNumbers.includes(n)) { showToast(`${getLetter(n)}-${n} was already called!`); return; }
  calledNumbers.push(n);
  input.value = '';
  input.focus();
  pushState();
  showToast(`${getLetter(n)}-${n} called!`);
}

function handleCallKey(e) { if (e.key === 'Enter') callNumber(); }

function undoLast() {
  if (calledNumbers.length === 0) { showToast('Nothing to undo.'); return; }
  const removed = calledNumbers.pop();
  pushState();
  showToast(`Removed ${getLetter(removed)}-${removed}`);
}

// ─── NEXT ROUND ───────────────────────────────────────────────────────────────
function nextRound() {
  const nextNum = currentRound + 1;
  const label = nextNum > ROUND_DATA.length ? `Round ${nextNum}` : `Round ${nextNum}`;
  if (!confirm(`Start Round ${nextNum}? This will clear all called numbers.`)) return;

  isBonusRound = false;
  currentRound = nextNum;

  // Auto-fill from hard-coded data if available
  const data = ROUND_DATA.find(r => r.round === nextNum);
  if (data) {
    currentPrize      = data.prize;
    currentPattern    = data.pattern;
    currentRoundTitle = data.title;
  } else {
    currentRoundTitle = `Round ${nextNum}`;
    // keep prize and pattern from previous round
  }

  calledNumbers = [];
  syncCallerInputs();
  pushState();
  showToast(`Round ${currentRound} started!`);
}

// ─── BONUS ROUND ──────────────────────────────────────────────────────────────
function startBonusRound() {
  if (!confirm('Start a Bonus Round? This will clear all called numbers.')) return;
  isBonusRound      = true;
  currentRoundTitle = 'Bonus Round';
  currentPrize      = '';
  // keep pattern from last round — caller can change it
  calledNumbers = [];
  syncCallerInputs();
  pushState();
  showToast('Bonus Round started!');
}

// Sync the editable caller fields to match current state
function syncCallerInputs() {
  const sel = document.getElementById('pattern-select');
  if (sel) sel.value = currentPattern;
  const prizeInput = document.getElementById('prize-input');
  if (prizeInput) prizeInput.value = currentPrize;
  const titleInput = document.getElementById('round-title-input');
  if (titleInput) titleInput.value = currentRoundTitle;
}

// ─── CALLER EDITS ─────────────────────────────────────────────────────────────
function updatePrize() {
  currentPrize = document.getElementById('prize-input').value;
  pushState();
}

function updateRoundTitle() {
  currentRoundTitle = document.getElementById('round-title-input').value;
  pushState();
}

function callerUpdatePattern() {
  currentPattern = document.getElementById('pattern-select').value;
  pushState();
}

// ─── BUILD PATTERN SELECT ─────────────────────────────────────────────────────
function buildPatternSelect() {
  const sel = document.getElementById('pattern-select');
  sel.innerHTML = '';
  Object.entries(PATTERNS).forEach(([val, info]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = info.name;
    sel.appendChild(opt);
  });
  sel.value = currentPattern;
}

// ─── RENDER ALL ───────────────────────────────────────────────────────────────
function renderAll() {
  renderBoard();
  updateCallerBall();
  updatePresenterBall();
  updateRecentBalls();
  updateBallCount();
  renderCallerPattern();
  renderPresenterPattern();
  updateRoundPrizeDisplay();
}

function updateRoundPrizeDisplay() {
  // Presenter
  const roundEl = document.getElementById('presenter-round');
  const prizeEl = document.getElementById('presenter-prize');
  if (roundEl) roundEl.textContent = currentRoundTitle || `Round ${currentRound}`;
  if (prizeEl) {
    if (isBonusRound) {
      prizeEl.textContent = 'Bonus Round - Prize TBD';
    } else {
  
      prizeEl.textContent = (currentPrize &&round<=10) ? ` ${currentPrize}` : 'Prize TBD';
    }
  }

  // Caller status badge
  const callerRoundEl = document.getElementById('caller-round-display');
  if (callerRoundEl) callerRoundEl.textContent = isBonusRound ? 'Bonus Round' : `Round ${currentRound}`;
}

// ─── BOARD ───────────────────────────────────────────────────────────────────
function initBoard() {
  const board = document.getElementById('bingo-board');
  const letters = ['B','I','N','G','O'];
  board.innerHTML = '';
  letters.forEach(l => {
    const h = document.createElement('div');
    h.className = `col-header ${l}`;
    h.textContent = l;
    board.appendChild(h);
  });
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 5; col++) {
      const n = col * 15 + row + 1;
      const cell = document.createElement('div');
      cell.className = 'board-cell';
      cell.id = `cell-${n}`;
      cell.textContent = n;
      board.appendChild(cell);
    }
  }
}

function renderBoard() {
  const latest = calledNumbers[calledNumbers.length - 1];
  for (let n = 1; n <= 75; n++) {
    const cell = document.getElementById(`cell-${n}`);
    if (!cell) continue;
    if (n === latest)                    cell.className = 'board-cell latest';
    else if (calledNumbers.includes(n))  cell.className = 'board-cell called';
    else                                 cell.className = 'board-cell';
  }
}

// ─── BALL DISPLAY ─────────────────────────────────────────────────────────────
function setBallDisplay(ballEl, letterEl, numberEl) {
  if (calledNumbers.length === 0) {
    ballEl.className = ballEl.className.replace(/\b(B|I|N|G|O|animate)\b/g, '').trim() + ' empty';
    letterEl.textContent = '?';
    numberEl.textContent = '—';
    return;
  }
  const latest = calledNumbers[calledNumbers.length - 1];
  const l = getLetter(latest);
  ballEl.className = ballEl.className.replace(/\b(B|I|N|G|O|empty|animate)\b/g, '').trim() + ` ${l} animate`;
  letterEl.textContent = l;
  numberEl.textContent = latest;
  setTimeout(() => { ballEl.className = ballEl.className.replace(' animate', ''); }, 400);
}

function updateCallerBall() {
  setBallDisplay(
    document.getElementById('caller-big-ball'),
    document.getElementById('caller-big-letter'),
    document.getElementById('caller-big-number')
  );
}

function updatePresenterBall() {
  setBallDisplay(
    document.getElementById('presenter-big-ball'),
    document.getElementById('presenter-big-letter'),
    document.getElementById('presenter-big-number')
  );
}

// ─── RECENT BALLS ────────────────────────────────────────────────────────────
function recentBallsHTML(limit) {
  const recent = calledNumbers.slice(-limit).reverse();
  if (recent.length === 0) return '<span style="color:var(--text-muted);font-size:0.85rem;">No numbers called yet</span>';
  return recent.map((n, i) => {
    const l = getLetter(n);
    const fade = i === 0 ? '' : `opacity:${Math.max(0.2, 1 - i * 0.04)};`;
    return `<div class="mini-ball ${l}" style="${fade}">${n}</div>`;
  }).join('');
}

function updateRecentBalls() {
  document.getElementById('recent-balls').innerHTML          = recentBallsHTML(10);
  document.getElementById('presenter-recent-balls').innerHTML = recentBallsHTML(20);
}

function updateBallCount() {
  document.getElementById('balls-count').textContent =
    `${calledNumbers.length} ball${calledNumbers.length !== 1 ? 's' : ''} called`;
}

// ─── PATTERN PREVIEW ─────────────────────────────────────────────────────────
function renderPatternPreview(containerId, pattern) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = document.createElement('div');
      const isCenter = r === 2 && c === 2;
      let on = false;
      if      (pattern === 'line')      on = r === 2 || c === 2 || r === c || r === 4-c;
      else if (pattern === 'corners')   on = (r === 0 || r === 4) && (c === 0 || c === 4);
      else if (pattern === 't-shape')   on = r === 0 || c === 2;
      else if (pattern === 'plus')      on = r === 2 || c === 2;
      else if (pattern === 'x-shape')   on = r === c || r === 4-c;
      else if (pattern === 'frame')     on = r === 0 || r === 4 || c === 0 || c === 4;
      else if (pattern === 'coverall')  on = true;
      else if (pattern === 'postage')   on = r <= 1 && c >= 3;
      else if (pattern === 'l-shape')   on = r === 4 || c === 0;
      else if (pattern === 'block6')    on = r >= 1 && r <= 2 && c >= 1 && c <= 3;
      else if (pattern === 'standing')  on = (r + c) % 2 === 0;  // checkerboard hint
      else if (pattern === 'standing2') on = r % 2 === 0;
      cell.className = `pp-cell${isCenter ? ' free' : (on ? ' on' : '')}`;
      container.appendChild(cell);
    }
  }
}

function renderCallerPattern() {
  const info = PATTERNS[currentPattern] || PATTERNS['line'];
  document.getElementById('caller-pattern-name').textContent = info.name;
  document.getElementById('caller-pattern-desc').textContent = info.desc;
  renderPatternPreview('caller-pattern-preview', currentPattern);
}

function renderPresenterPattern() {
  const info = PATTERNS[currentPattern] || PATTERNS['line'];
  document.getElementById('presenter-win-name').textContent = info.name;
  document.getElementById('presenter-win-desc').textContent = info.desc;
  renderPatternPreview('presenter-pattern-preview', currentPattern);
}

// ─── MODE SWITCHING ───────────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  document.getElementById('btn-caller').className = 'btn-mode' + (m === 'caller'    ? ' active' : '');
  document.getElementById('btn-player').className = 'btn-mode' + (m === 'presenter' ? ' active' : '');
  document.getElementById('mode-label').textContent = m === 'caller' ? 'Caller Mode' : 'Presenter View';
  document.getElementById('caller-view').style.display    = m === 'caller'    ? 'block' : 'none';
  document.getElementById('presenter-view').style.display = m === 'presenter' ? 'block' : 'none';
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ─── BOOT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  connectFirebase();
});