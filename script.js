
// ─── STATE ───────────────────────────────────────────────────────────────────
let mode = 'caller';
let calledNumbers = [];
let playerCard = [];
let playerDaubed = new Set();
let db = null;
let localMode = false;
let gameRef = null;

// ─── PATTERNS ────────────────────────────────────────────────────────────────
const PATTERNS = {
  'line': {
    name: 'Standard Line',
    desc: 'Get 5 in a row — horizontally, vertically, or diagonally. The FREE space counts!',
    cells: null, // computed dynamically
    check: checkLine
  },
  'corners': {
    name: 'Four Corners',
    desc: 'Mark the four corner squares: B1, B15, O1, and O75.',
    cells: [[0,0],[0,4],[4,0],[4,4]],
    check: checkCorners
  },
  't-shape': {
    name: 'T-Shape',
    desc: 'Fill the entire top row plus the middle column.',
    cells: buildTShape(),
    check: checkTShape
  },
  'x-shape': {
    name: 'X-Shape',
    desc: 'Mark both diagonals — they form an X across the card.',
    cells: buildXShape(),
    check: checkXShape
  },
  'frame': {
    name: 'Frame',
    desc: 'Fill all 16 squares around the outer edge of the card.',
    cells: buildFrame(),
    check: checkFrame
  },
  'coverall': {
    name: 'Coverall (Blackout)',
    desc: 'Mark every single square on your card. Very tough!',
    cells: buildCoverall(),
    check: checkCoverall
  },
  'postage': {
    name: 'Postage Stamp',
    desc: 'Fill the 2×2 square in the top-right corner.',
    cells: [[0,3],[0,4],[1,3],[1,4]],
    check: checkPostage
  },
  'l-shape': {
    name: 'L-Shape',
    desc: 'Fill the entire bottom row and entire left column.',
    cells: buildLShape(),
    check: checkLShape
  }
};

function buildTShape() {
  let cells = [];
  for (let c = 0; c < 5; c++) cells.push([0, c]);
  for (let r = 1; r < 5; r++) cells.push([r, 2]);
  return cells;
}
function buildXShape() {
  let cells = [];
  for (let i = 0; i < 5; i++) { cells.push([i, i]); cells.push([i, 4-i]); }
  return [...new Set(cells.map(c=>JSON.stringify(c)))].map(c=>JSON.parse(c));
}
function buildFrame() {
  let cells = [];
  for (let c = 0; c < 5; c++) { cells.push([0,c]); cells.push([4,c]); }
  for (let r = 1; r < 4; r++) { cells.push([r,0]); cells.push([r,4]); }
  return cells;
}
function buildCoverall() {
  let cells = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) cells.push([r,c]);
  return cells;
}
function buildLShape() {
  let cells = [];
  for (let c = 0; c < 5; c++) cells.push([4,c]);
  for (let r = 0; r < 4; r++) cells.push([r,0]);
  return cells;
}

// ─── BINGO CARD GENERATION ────────────────────────────────────────────────────
function generateCard() {
  playerDaubed = new Set();
  playerCard = [];
  const cols = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  for (let c = 0; c < 5; c++) {
    const [lo,hi] = cols[c];
    const pool = [];
    for (let n = lo; n <= hi; n++) pool.push(n);
    shuffle(pool);
    for (let r = 0; r < 5; r++) {
      if (r === 2 && c === 2) { playerCard.push('FREE'); }
      else { playerCard.push(pool[r]); }
    }
  }
  // transpose: we stored col-major, need row-major for display
  const grid = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      grid.push(playerCard[c*5+r]);
    }
  }
  playerCard = grid;
  renderPlayerCard();
  document.getElementById('bingo-alert').style.display = 'none';
  saveCardToStorage();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
}

function saveCardToStorage() {
  try { localStorage.setItem('bingo_card', JSON.stringify(playerCard)); } catch(e){}
}

function loadCardFromStorage() {
  try {
    const saved = localStorage.getItem('bingo_card');
    if (saved) { playerCard = JSON.parse(saved); return true; }
  } catch(e){}
  return false;
}

// ─── FIREBASE ────────────────────────────────────────────────────────────────
function connectFirebase() {
  const url = 'https://bingogamemd-default-rtdb.firebaseio.com/' ;
  if (!url || !url.includes('firebaseio.com')) {
    showToast('Please enter a valid Firebase Realtime Database URL.');
    return;
  }
  localStorage.setItem('bingo_firebase_url', url);
  initFirebase('https://bingogamemd-default-rtdb.firebaseio.com/');
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
    document.getElementById('firebase-setup').style.display = 'none';
    showMainContent();
    setStatusOnline();
  } catch(e) {
    showToast('Firebase connection failed: ' + e.message);
  }
}

function useLocalMode() {
  localMode = true;
  document.getElementById('firebase-setup').style.display = 'none';
  showMainContent();
  setStatusOffline();
}

function showMainContent() {
  document.getElementById('status-bar').style.display = 'flex';
  document.getElementById('main-content').style.display = 'block';
  initBoard();
  if (!loadCardFromStorage()) generateCard();
  else renderPlayerCard();
  renderBoard();
  updatePattern();
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
    const data = snapshot.val();
    if (data && data.called) {
      calledNumbers = data.called;
    } else {
      calledNumbers = [];
    }
    renderBoard();
    renderPlayerCard();
    updateBigBall();
    updateRecentBalls();
    updateBallCount();
  }, err => {
    showToast('Sync error: ' + err.message);
    setStatusOffline();
  });
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
  if (isNaN(n) || n < 1 || n > 75) {
    showToast('Please enter a number between 1 and 75.');
    return;
  }
  if (calledNumbers.includes(n)) {
    showToast(`${getLetter(n)}-${n} was already called!`);
    return;
  }
  calledNumbers.push(n);
  input.value = '';
  input.focus();
  pushCalledNumbers();
  showToast(`${getLetter(n)}-${n} called!`);
}

function handleCallKey(e) {
  if (e.key === 'Enter') callNumber();
}

function undoLast() {
  if (calledNumbers.length === 0) { showToast('Nothing to undo.'); return; }
  const removed = calledNumbers.pop();
  pushCalledNumbers();
  showToast(`Removed ${getLetter(removed)}-${removed}`);
}

function pushCalledNumbers() {
  if (localMode || !gameRef) {
    renderBoard();
    renderPlayerCard();
    updateBigBall();
    updateRecentBalls();
    updateBallCount();
    return;
  }
  gameRef.set({ called: calledNumbers });
}

function confirmReset() {
  if (!confirm('Reset the game? All called numbers will be cleared.')) return;
  calledNumbers = [];
  pushCalledNumbers();
  showToast('Game reset!');
}

// ─── BOARD RENDERING ─────────────────────────────────────────────────────────
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
  // Add row of 5 for each letter header... actually the grid just needs 75 cells
  // We do 5 header + 75 number cells arranged properly
  // Reset: 5 headers across, then 15 rows × 5 = 75 cells
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 5; c++) {
      const n = c * 15 + r + 1;
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
    if (n === latest) {
      cell.className = 'board-cell latest';
    } else if (calledNumbers.includes(n)) {
      cell.className = 'board-cell called';
    } else {
      cell.className = 'board-cell';
    }
  }
}

function updateBigBall() {
  const ball = document.getElementById('big-ball');
  const letter = document.getElementById('big-letter');
  const number = document.getElementById('big-number');
  if (calledNumbers.length === 0) {
    ball.className = 'big-ball empty';
    letter.textContent = '?';
    number.textContent = '—';
    return;
  }
  const latest = calledNumbers[calledNumbers.length - 1];
  const l = getLetter(latest);
  ball.className = `big-ball ${l} animate`;
  letter.textContent = l;
  number.textContent = latest;
  setTimeout(() => ball.classList.remove('animate'), 400);
}

function updateRecentBalls() {
  const container = document.getElementById('recent-balls');
  const recent = calledNumbers.slice(-8).reverse();
  if (recent.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem;">No numbers called yet</span>';
    return;
  }
  container.innerHTML = recent.map((n, i) => {
    const l = getLetter(n);
    const opacity = i === 0 ? '' : `opacity:${Math.max(0.3, 1 - i*0.1)};transform:scale(${Math.max(0.75, 1-i*0.04)})`;
    return `<div class="mini-ball ${l}" style="${opacity}">${n}</div>`;
  }).join('');
}

function updateBallCount() {
  document.getElementById('balls-count').textContent = `${calledNumbers.length} ball${calledNumbers.length !== 1 ? 's' : ''} called`;
}

// ─── PLAYER CARD ──────────────────────────────────────────────────────────────
function renderPlayerCard() {
  const container = document.getElementById('player-card');
  if (!playerCard || playerCard.length === 0) return;
  const letters = ['B','I','N','G','O'];
  container.innerHTML = '';

  // Headers
  letters.forEach(l => {
    const h = document.createElement('div');
    h.className = `col-header ${l}`;
    h.textContent = l;
    h.style.cssText = 'font-size:1rem;padding:0.3rem 0;';
    container.appendChild(h);
  });

  playerCard.forEach((val, idx) => {
    const cell = document.createElement('div');
    if (val === 'FREE') {
      cell.className = 'pc-cell free-space';
      cell.textContent = 'FREE';
      cell.title = 'Free space!';
    } else {
      const isCalled = calledNumbers.includes(val);
      const isDaubed = playerDaubed.has(idx);
      cell.className = `pc-cell${isDaubed ? ' daubed' : ''}${isCalled && !isDaubed ? ' called-match' : ''}`;
      cell.textContent = val;
      cell.onclick = () => toggleDaub(idx);
    }
    container.appendChild(cell);
  });

  checkBingo();
}

function toggleDaub(idx) {
  if (playerCard[idx] === 'FREE') return;
  if (playerDaubed.has(idx)) playerDaubed.delete(idx);
  else playerDaubed.add(idx);
  renderPlayerCard();
}

// ─── BINGO CHECK ─────────────────────────────────────────────────────────────
function isMarked(r, c) {
  const idx = r * 5 + c;
  if (playerCard[idx] === 'FREE') return true;
  return playerDaubed.has(idx);
}

function checkLine() {
  // Rows
  for (let r = 0; r < 5; r++) {
    if ([0,1,2,3,4].every(c => isMarked(r,c))) return true;
  }
  // Cols
  for (let c = 0; c < 5; c++) {
    if ([0,1,2,3,4].every(r => isMarked(r,c))) return true;
  }
  // Diagonals
  if ([0,1,2,3,4].every(i => isMarked(i,i))) return true;
  if ([0,1,2,3,4].every(i => isMarked(i,4-i))) return true;
  return false;
}

function checkCorners() { return isMarked(0,0) && isMarked(0,4) && isMarked(4,0) && isMarked(4,4); }
function checkTShape() { return buildTShape().every(([r,c]) => isMarked(r,c)); }
function checkXShape() { return buildXShape().every(([r,c]) => isMarked(r,c)); }
function checkFrame() { return buildFrame().every(([r,c]) => isMarked(r,c)); }
function checkCoverall() { return buildCoverall().every(([r,c]) => isMarked(r,c)); }
function checkPostage() { return [[0,3],[0,4],[1,3],[1,4]].every(([r,c]) => isMarked(r,c)); }
function checkLShape() { return buildLShape().every(([r,c]) => isMarked(r,c)); }

function checkBingo() {
  const pattern = document.getElementById('pattern-select').value;
  const info = PATTERNS[pattern];
  const won = info.check();
  const alert = document.getElementById('bingo-alert');
  alert.style.display = won ? 'block' : 'none';
}

// ─── PATTERN PREVIEW ─────────────────────────────────────────────────────────
function updatePattern() {
  const pattern = document.getElementById('pattern-select').value;
  const info = PATTERNS[pattern];
  document.getElementById('pattern-name').textContent = info.name;
  document.getElementById('pattern-desc-text').textContent = info.desc;
  renderPatternPreview(pattern);
  checkBingo();
}

function renderPatternPreview(pattern) {
  const container = document.getElementById('pattern-preview');
  container.innerHTML = '';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = document.createElement('div');
      const isCenter = r === 2 && c === 2;
      let on = false;
      if (pattern === 'line') {
        on = r === 2 || c === 2 || r === c || r === 4-c;
      } else if (pattern === 'corners') {
        on = (r === 0 || r === 4) && (c === 0 || c === 4);
      } else if (pattern === 't-shape') {
        on = r === 0 || c === 2;
      } else if (pattern === 'x-shape') {
        on = r === c || r === 4-c;
      } else if (pattern === 'frame') {
        on = r === 0 || r === 4 || c === 0 || c === 4;
      } else if (pattern === 'coverall') {
        on = true;
      } else if (pattern === 'postage') {
        on = (r <= 1 && c >= 3);
      } else if (pattern === 'l-shape') {
        on = r === 4 || c === 0;
      }
      cell.className = `pp-cell${isCenter ? ' free' : (on ? ' on' : '')}`;
      container.appendChild(cell);
    }
  }
}

// ─── MODE SWITCHING ───────────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  document.getElementById('btn-caller').className = 'btn-mode' + (m === 'caller' ? ' active' : '');
  document.getElementById('btn-player').className = 'btn-mode' + (m === 'player' ? ' active' : '');
  document.getElementById('mode-label').textContent = m === 'caller' ? 'Caller Mode' : 'Player Mode';
  document.getElementById('caller-panel').style.display = m === 'caller' ? 'block' : 'none';
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

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Try to restore Firebase URL
  const savedUrl = localStorage.getItem('bingo_firebase_url');
  if (savedUrl) {
    document.getElementById('firebase-url-input').value = savedUrl;
    initFirebase(savedUrl);
  }
});
