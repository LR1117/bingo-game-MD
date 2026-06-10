// ─── STATE ───────────────────────────────────────────────────────────────────
let mode = 'presenter';
let calledNumbers = [];
let currentPattern = 'line';
let db = null;
let localMode = false;
let gameRef = null;

// ─── PATTERN DEFINITIONS ─────────────────────────────────────────────────────
const PATTERNS = {
  'line':     { name: 'Standard',             desc: 'Get 5 in a row — horizontally, vertically, or diagonally. The FREE space counts!' },
  'corners':  { name: 'Four Corners',         desc: 'Mark the four corner squares: B1, B15, O1, and O75.' },
  't-shape':  { name: 'T-Shape',              desc: 'Fill the entire top row plus the middle column.' },
  'x-shape':  { name: 'X-Shape',              desc: 'Mark both diagonals — they form an X across the card.' },
  'frame':    { name: 'Frame',                desc: 'Fill all 16 squares around the outer edge of the card.' },
  'coverall': { name: 'Coverall (Blackout)',  desc: 'Mark every single square on your card. Very tough!' },
  'postage':  { name: 'Postage Stamp',        desc: 'Fill the 2×2 square in the top-right corner.' },
  'l-shape':  { name: 'L-Shape',              desc: 'Fill the entire bottom row and entire left column.' }
};

// ─── FIREBASE ────────────────────────────────────────────────────────────────
function connectFirebase() {
  const url = (typeof FIREBASE_DATABASE_URL !== 'undefined' && FIREBASE_DATABASE_URL !== 'YOUR_FIREBASE_DATABASE_URL_HERE')
    ? FIREBASE_DATABASE_URL
    : null;

  if (!url || !url.includes('firebaseio.com')) {
    showToast('⚠️ No Firebase URL set — running in local mode. Edit config.js or your .env file.');
    useLocalMode();
    return;
  }
  initFirebase(url);
}

function initFirebase(url) {
  try {
    if (firebase.apps.length > 0) {
      firebase.app().delete().then(() => _initFB(url));
    } else {
      _initFB(url);
    }
  } catch(e) {
    _initFB(url);
  }
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
    calledNumbers  = data.called  || [];
    currentPattern = data.pattern || 'line';

    // Keep caller dropdown in sync (in case another caller tab changed it)
    const sel = document.getElementById('pattern-select');
    if (sel && sel.value !== currentPattern) sel.value = currentPattern;

    renderAll();
  }, err => {
    showToast('Sync error: ' + err.message);
    setStatusOffline();
  });
}

// ─── PUSH TO FIREBASE ────────────────────────────────────────────────────────
function pushState() {
  if (localMode || !gameRef) {
    renderAll();
    return;
  }
  gameRef.set({ called: calledNumbers, pattern: currentPattern });
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

function confirmReset() {
  if (!confirm('Restart the game? All called numbers will be cleared.')) return;
  calledNumbers = [];
  pushState();
  showToast('Game restarted!');
}

// ─── WIN CONDITION (caller changes, syncs to DB, presenter reads) ─────────────
function callerUpdatePattern() {
  currentPattern = document.getElementById('pattern-select').value;
  pushState();   // saves pattern to Firebase so presenter picks it up
}

// ─── RENDER ALL ──────────────────────────────────────────────────────────────
function renderAll() {
  renderBoard();
  updateCallerBall();
  updatePresenterBall();
  updateRecentBalls();
  updateBallCount();
  renderCallerPattern();
  renderPresenterPattern();
}

// ─── BOARD (caller only) ──────────────────────────────────────────────────────
// Layout: 5 columns (B I N G O), 15 rows per column.
// B=1–15, I=16–30, N=31–45, G=46–60, O=61–75
// Grid is row-major (left→right across columns, top→bottom across rows),
// so row 0 = [1,16,31,46,61], row 1 = [2,17,32,47,62], etc.
function initBoard() {
  const board = document.getElementById('bingo-board');
  const letters = ['B','I','N','G','O'];
  board.innerHTML = '';

  // Column headers
  letters.forEach(l => {
    const h = document.createElement('div');
    h.className = `col-header ${l}`;
    h.textContent = l;
    board.appendChild(h);
  });

  // 15 rows × 5 columns
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 5; col++) {
      const n = col * 15 + row + 1;   // B col: 1–15, I col: 16–30, etc.
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
    if (n === latest)                   cell.className = 'board-cell latest';
    else if (calledNumbers.includes(n)) cell.className = 'board-cell called';
    else                                cell.className = 'board-cell';
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
function recentBallsHTML() {
  const recent = calledNumbers.slice(-10).reverse();
  if (recent.length === 0) return '<span style="color:var(--text-muted);font-size:0.85rem;">No numbers called yet</span>';
  return recent.map((n, i) => {
    const l = getLetter(n);
    const style = i === 0 ? '' : `opacity:${Math.max(0.3, 1 - i * 0.09)};transform:scale(${Math.max(0.75, 1 - i * 0.035)})`;
    return `<div class="mini-ball ${l}" style="${style}">${n}</div>`;
  }).join('');
}

function updateRecentBalls() {
  const html = recentBallsHTML();
  document.getElementById('recent-balls').innerHTML = html;
  document.getElementById('presenter-recent-balls').innerHTML = html;
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
      if      (pattern === 'line')    on = r === 2 || c === 2 || r === c || r === 4-c;
      else if (pattern === 'corners') on = (r === 0 || r === 4) && (c === 0 || c === 4);
      else if (pattern === 't-shape') on = r === 0 || c === 2;
      else if (pattern === 'x-shape') on = r === c || r === 4-c;
      else if (pattern === 'frame')   on = r === 0 || r === 4 || c === 0 || c === 4;
      else if (pattern === 'coverall') on = true;
      else if (pattern === 'postage') on = r <= 1 && c >= 3;
      else if (pattern === 'l-shape') on = r === 4 || c === 0;
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
  renderPatternPreview('presenter-pattern-preview', currentPattern);
}

// ─── MODE SWITCHING ───────────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  document.getElementById('btn-caller').className   = 'btn-mode' + (m === 'caller'    ? ' active' : '');
  document.getElementById('btn-player').className   = 'btn-mode' + (m === 'presenter' ? ' active' : '');
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

// ─── BOOT — wait for DOM then connect ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  connectFirebase();
});