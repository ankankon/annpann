const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();

const TILE = 100;

// マップ定義
const map = [
  "################",
  "#S     #      E#",
  "# ### ####### ##",
  "#   #      #   #",
  "### ###### ### #",
  "#A      #      #",
  "###### ###### ##",
  "#      B#      #",
  "# ####### ######",
  "#      C       #",
  "################"
];

const DIRECTIONS = [
  {x:1, y:0}, {x:-1, y:0}, {x:0, y:1}, {x:0, y:-1}
];

const startPlayer = { x: TILE * 1.5, y: TILE * 1.5, angle: 0, pitch: 0 };
const startEnemy  = { x: TILE * 13.5, y: TILE * 9.5 };

let player, enemy;
let keys = {};
let switches = { A: false, B: false, C: false };
let playing = false;
let isPaused = false;
let currentMode = 'pc';

// ポーズ画面のキーボード選択用変数
let pauseSelectedIndex = 0;
const pauseButtons = document.getElementsByClassName("p-idx");

let touchMoveId = null, touchLookId = null;
let joyStart = { x: 0, y: 0 }, joyMove = { x: 0, y: 0 };
let lastLook = { x: 0, y: 0 };

// 滑らかな視点移動（スムージング）のための目標値管理
let targetAngle = 0;
let targetPitch = 0;

const menu = document.getElementById("menu");
const menuTitle = document.getElementById("menu-title");
const menuText = document.getElementById("menu-text");
const pauseMenu = document.getElementById("pause-menu");
const ingameMenuBtn = document.getElementById("ingame-menu-btn");
const info = document.getElementById("info");
const touchContainer = document.getElementById("touch-container");
const joyBase = document.getElementById("joystick-base");
const joyStick = document.getElementById("joystick-stick");

// 拡大・縮小（ズーム）防止
document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

resetGame();

function resetGame() {
  player = {
    x: startPlayer.x,
    y: startPlayer.y,
    angle: startPlayer.angle,
    pitch: 0
  };
  
  targetAngle = startPlayer.angle;
  targetPitch = 0;

  enemy = {
    x: startEnemy.x,
    y: startEnemy.y,
    speed: 1.5,
    chasing: false,
    loseTimer: 0,
    dir: { x: -1, y: 0 }
  };

  switches = { A: false, B: false, C: false };
}

function startGame(mode) {
  currentMode = mode;
  resetGame();
  playing = true;
  isPaused = false;
  menu.style.display = "none";
  pauseMenu.style.display = "none";
  ingameMenuBtn.style.display = "block";
  
  if (currentMode === 'pc') {
    touchContainer.style.display = "none";
    canvas.requestPointerLock();
  } else {
    touchContainer.style.display = "block";
  }
  
  message("迷路に潜む恐怖から逃げろ...");
}

// ==========================================
// ポーズメニュー関連の処理
// ==========================================
function openPauseMenu() {
  if (!playing || isPaused) return;
  isPaused = true;
  pauseMenu.style.display = "flex";
  if (currentMode === 'pc') {
    document.exitPointerLock();
  }
  pauseSelectedIndex = 0;
  updatePauseMenuSelection();
}

function resumeGame() {
  isPaused = false;
  pauseMenu.style.display = "none";
  if (currentMode === 'pc') {
    canvas.requestPointerLock();
  }
}

function retryGame() {
  pauseMenu.style.display = "none";
  startGame(currentMode);
}

function backToMainMenu() {
  playing = false;
  isPaused = false;
  pauseMenu.style.display = "none";
  ingameMenuBtn.style.display = "none";
  touchContainer.style.display = "none";
  menu.style.display = "flex";
  menuTitle.style.color = "red";
  menuTitle.textContent = "DEATH MAZE";
  menuText.textContent = "操作モードを選択してください";
}

function updatePauseMenuSelection() {
  for (let i = 0; i < pauseButtons.length; i++) {
    if (i === pauseSelectedIndex) {
      pauseButtons[i].classList.add("selected");
    } else {
      pauseButtons[i].classList.remove("selected");
    }
  }
}

// ポーズ中のPCブラウザ仕様
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && playing && currentMode === 'pc' && !isPaused) {
    openPauseMenu();
  }
});

function message(text) {
  info.textContent = text;
  clearTimeout(info.timer);
  info.timer = setTimeout(() => {
    info.textContent = "";
  }, 3000);
}

// 角度を 0 〜 2π に収める関数
function normalizeAngle(angle) {
  while (angle < 0) angle += Math.PI * 2;
  while (angle >= Math.PI * 2) angle -= Math.PI * 2;
  return angle;
}

// ==========================================
// 操作イベント処理（PC）
// ==========================================
document.addEventListener("mousemove", e => {
  if (currentMode === 'pc' && document.pointerLockElement === canvas && !isPaused) {
    
    // 🔴 【最重要】1フレームあたりの「最大移動角」を厳格に制限するフィルター
    // ブラウザのバグで巨大な移動量が送られてきても、1フレームで動く量を最大「約4.5度（0.08rad）」に強制制限します。
    let deltaAngle = e.movementX * 0.0022;
    deltaAngle = Math.max(-0.08, Math.min(0.08, deltaAngle)); // 限界値を設定
    
    targetAngle += deltaAngle;
    targetAngle = normalizeAngle(targetAngle);
    
    // 上下首振り（ピッチ）のバグ跳ね上がりも同様に1フレーム最大45pxまでに制限
    let deltaPitch = e.movementY * 1.5;
    deltaPitch = Math.max(-45, Math.min(45, deltaPitch));
    
    targetPitch -= deltaPitch;
    targetPitch = Math.max(-canvas.height / 2, Math.min(canvas.height / 2, targetPitch));
  }
});

// キーボードイベント全体の統括
window.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  keys[key] = true;

  // ゲームプレイ中に Esc または P キーでメニューを開く
  if (playing && !isPaused) {
    if (e.key === "Escape" || key === "p") {
      openPauseMenu();
      e.preventDefault();
      return;
    }
  }

  // ポーズメニュー表示中の操作
  if (isPaused) {
    if (e.key === "Escape" || key === "p") {
      resumeGame();
      e.preventDefault();
      return;
    }
    if (key === "arrowup" || key === "w") {
      pauseSelectedIndex = (pauseSelectedIndex - 1 + pauseButtons.length) % pauseButtons.length;
      updatePauseMenuSelection();
      e.preventDefault();
    }
    if (key === "arrowdown" || key === "s") {
      pauseSelectedIndex = (pauseSelectedIndex + 1) % pauseButtons.length;
      updatePauseMenuSelection();
      e.preventDefault();
    }
    if (key === "enter") {
      pauseButtons[pauseSelectedIndex].click();
      e.preventDefault();
    }
  }
});

window.addEventListener("keyup", e => { 
  keys[e.key.toLowerCase()] = false; 
});

// ==========================================
// 操作イベント処理（スマホタッチ）
// ==========================================
const leftZone = document.getElementById("left-zone");
leftZone.addEventListener("touchstart", e => {
  if (!playing || currentMode !== 'mobile' || isPaused) return;
  const touch = e.changedTouches[0];
  if (touchMoveId === null) {
    touchMoveId = touch.identifier;
    joyStart = { x: touch.clientX, y: touch.clientY };
    joyBase.style.display = "block";
    joyBase.style.left = joyStart.x + "px";
    joyBase.style.top = joyStart.y + "px";
    joyStick.style.transform = `translate(0px, 0px)`;
  }
}, { passive: false });

window.addEventListener("touchmove", e => {
  if (!playing || currentMode !== 'mobile' || isPaused) return;
  for (let touch of e.changedTouches) {
    if (touch.identifier === touchMoveId) {
      let dx = touch.clientX - joyStart.x;
      let dy = touch.clientY - joyStart.y;
      const dist = Math.hypot(dx, dy);
      const maxDist = 40;
      if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
      }
      joyMove = { x: dx / maxDist, y: dy / maxDist };
      joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    if (touch.identifier === touchLookId) {
      let dx = touch.clientX - lastLook.x;
      let dy = touch.clientY - lastLook.y;
      
      // スマホもフリック時の最大移動量を制限
      let deltaAngle = dx * 0.005;
      deltaAngle = Math.max(-0.1, Math.min(0.1, deltaAngle));
      targetAngle += deltaAngle;
      targetAngle = normalizeAngle(targetAngle);
      
      let deltaPitch = dy * 1.8;
      deltaPitch = Math.max(-50, Math.min(50, deltaPitch));
      targetPitch -= deltaPitch;
      targetPitch = Math.max(-canvas.height / 2, Math.min(canvas.height / 2, targetPitch));
      lastLook = { x: touch.clientX, y: touch.clientY };
    }
  }
}, { passive: false });

const rightZone = document.getElementById("right-zone");
rightZone.addEventListener("touchstart", e => {
  if (!playing || currentMode !== 'mobile' || isPaused) return;
  const touch = e.changedTouches[0];
  if (touchLookId === null) {
    touchLookId = touch.identifier;
    lastLook = { x: touch.clientX, y: touch.clientY };
  }
}, { passive: false });

window.addEventListener("touchend", e => {
  for (let touch of e.changedTouches) {
    if (touch.identifier === touchMoveId) {
      touchMoveId = null;
      joyMove = { x: 0, y: 0 };
      joyBase.style.display = "none";
    }
    if (touch.identifier === touchLookId) {
      touchLookId = null;
    }
  }
});

// ==========================================
// 毎フレームの視点更新（なめらか Lerp）
// ==========================================
function updateCamera() {
  let diffAngle = targetAngle - player.angle;
  
  while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
  while (diffAngle > Math.PI)  diffAngle -= Math.PI * 2;
  
  player.angle += diffAngle * 0.35;
  player.angle = normalizeAngle(player.angle);
  
  player.pitch += (targetPitch - player.pitch) * 0.35;
}

// ==========================================
// ゲームロジック・AI処理
// ==========================================
function isWall(x, y) {
  const gx = Math.floor(x / TILE);
  const gy = Math.floor(y / TILE);
  if (!map[gy] || !map[gy][gx]) return true;
  return map[gy][gx] === "#";
}

function canSeePlayer() {
  let dx = player.x - enemy.x;
  let dy = player.y - enemy.y;
  let dist = Math.hypot(dx, dy);
  let steps = dist / 5;
  for (let i = 0; i < steps; i++) {
    let t = i / steps;
    let rx = enemy.x + dx * t;
    let ry = enemy.y + dy * t;
    if (isWall(rx, ry)) return false;
  }
  return true;
}

function movePlayer() {
  const speed = 3.5;
  let moveX = 0;
  let moveY = 0;

  if (currentMode === 'pc') {
    if (keys["w"]) { moveX += Math.cos(player.angle); moveY += Math.sin(player.angle); }
    if (keys["s"]) { moveX -= Math.cos(player.angle); moveY -= Math.sin(player.angle); }
    if (keys["a"]) { moveX += Math.cos(player.angle - Math.PI / 2); moveY += Math.sin(player.angle - Math.PI / 2); }
    if (keys["d"]) { moveX += Math.cos(player.angle + Math.PI / 2); moveY += Math.sin(player.angle + Math.PI / 2); }
  }

  if (currentMode === 'mobile' && touchMoveId !== null) {
    moveX += Math.cos(player.angle) * (-joyMove.y) + Math.cos(player.angle + Math.PI / 2) * joyMove.x;
    moveY += Math.sin(player.angle) * (-joyMove.y) + Math.sin(player.angle + Math.PI / 2) * joyMove.x;
  }

  const len = Math.hypot(moveX, moveY);
  if (len > 0) {
    let nx = player.x + (moveX / len) * speed;
    let ny = player.y + (moveY / len) * speed;

    if (!isWall(nx, player.y)) player.x = nx;
    if (!isWall(player.x, ny)) player.y = ny;
  }

  checkEvents();
}

function enemyAtCenter() {
  return (
    Math.abs((enemy.x % TILE) - TILE / 2) < 5 &&
    Math.abs((enemy.y % TILE) - TILE / 2) < 5
  );
}

function getAvailableDirections() {
  const dirs = [];
  const gx = Math.floor(enemy.x / TILE);
  const gy = Math.floor(enemy.y / TILE);
  for (let dir of DIRECTIONS) {
    const nx = gx + dir.x;
    const ny = gy + dir.y;
    if (map[ny] && map[ny][nx] !== "#") dirs.push(dir);
  }
  return dirs;
}

function moveEnemy() {
  if (canSeePlayer()) {
    if (!enemy.chasing) message("見つかった！！！");
    enemy.chasing = true;
    enemy.loseTimer = 0;
  } else {
    if (enemy.chasing) {
      enemy.loseTimer++;
      if (enemy.loseTimer > 240) {
        enemy.chasing = false;
        message("撒いたようだ...");
      }
    }
  }

  if (enemy.chasing) {
    let dx = player.x - enemy.x;
    let dy = player.y - enemy.y;
    let dist = Math.hypot(dx, dy);
    dx /= dist; dy /= dist;

    let currentSpeed = enemy.speed * 1.35;
    let nx = enemy.x + dx * currentSpeed;
    let ny = enemy.y + dy * currentSpeed;

    if (!isWall(nx, enemy.y)) enemy.x = nx;
    if (!isWall(enemy.x, ny)) enemy.y = ny;

    if (dist < 25) gameOver();
  } else {
    if (enemyAtCenter()) {
      let dirs = getAvailableDirections();
      if (dirs.length > 1) {
        dirs = dirs.filter(dir => !(dir.x === -enemy.dir.x && dir.y === -enemy.dir.y));
      }
      if (dirs.length > 0) {
        enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
      }
    }
    let nx = enemy.x + enemy.dir.x * enemy.speed;
    let ny = enemy.y + enemy.dir.y * enemy.speed;

    if (!isWall(nx, ny)) {
      enemy.x = nx;
      enemy.y = ny;
    } else {
      enemy.x = (Math.floor(enemy.x / TILE) + 0.5) * TILE;
      enemy.y = (Math.floor(enemy.y / TILE) + 0.5) * TILE;
      let dirs = getAvailableDirections();
      if(dirs.length > 0) enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
    }
  }
}

function checkEvents() {
  const gx = Math.floor(player.x / TILE);
  const gy = Math.floor(player.y / TILE);
  if (!map[gy] || !map[gy][gx]) return;
  const cell = map[gy][gx];

  if (cell === "A" && !switches.A) { switches.A = true; message("【A】スイッチを起動した！"); }
  if (cell === "B" && !switches.B) { switches.B = true; message("【B】スイッチを起動した！"); }
  if (cell === "C" && !switches.C) { switches.C = true; message("【C】スイッチを起動した！"); }

  if (cell === "E") {
    if (switches.A && switches.B && switches.C) {
      finishGame();
    } else {
      message("出口のロックが解除されていない...");
    }
  }
}

// ==========================================
// 描画（グラフィック）処理
// ==========================================
function drawWorld() {
  const horizon = canvas.height / 2 + player.pitch;

  ctx.fillStyle = "#111a24";
  ctx.fillRect(0, 0, canvas.width, horizon);

  ctx.fillStyle = "#222222";
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);

  const fov = 1.0;
  for (let i = 0; i < canvas.width; i++) {
    let rayAngle = player.angle - (fov / 2) + (i / canvas.width) * fov;

    let dist = 0;
    let hit = false;

    while (!hit && dist < 1200) {
      dist += 1.5;
      let rx = player.x + Math.cos(rayAngle) * dist;
      let ry = player.y + Math.sin(rayAngle) * dist;

      if (isWall(rx, ry)) {
        hit = true;
      }
    }

    let corrected = dist * Math.cos(rayAngle - player.angle);
    if (corrected < 1) corrected = 1;

    let wallHeight = (22000 / corrected) * (canvas.height / 600);
    let shade = Math.max(20, 200 - corrected / 4);

    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ctx.fillRect(i, horizon - wallHeight / 2, 1, wallHeight);
  }
}

function drawEnemy() {
  let dx = enemy.x - player.x;
  let dy = enemy.y - player.y;
  let dist = Math.hypot(dx, dy);

  let angle = Math.atan2(dy, dx);
  let relative = angle - player.angle;

  while (relative < -Math.PI) relative += Math.PI * 2;
  while (relative > Math.PI)  relative -= Math.PI * 2;

  if (Math.abs(relative) > 0.65) return;

  let checkDist = 0;
  while (checkDist < dist) {
    checkDist += 4;
    let rx = player.x + Math.cos(angle) * checkDist;
    let ry = player.y + Math.sin(angle) * checkDist;
    if (isWall(rx, ry)) return;
  }

  let screenX = (relative + 0.65) / 1.3 * canvas.width;
  let size = (9000 / dist) * (canvas.height / 600);
  let horizon = canvas.height / 2 + player.pitch;
  let y = horizon - size / 2;

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(screenX, y + size * 0.95, size * 0.28, size * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(screenX - size * 0.15, y + size * 0.55, size * 0.1, size * 0.35);
  ctx.fillRect(screenX + size * 0.05, y + size * 0.55, size * 0.1, size * 0.35);

  ctx.fillStyle = enemy.chasing ? "#660000" : "#1f1f1f";
  ctx.fillRect(screenX - size * 0.22, y + size * 0.2, size * 0.44, size * 0.45);

  ctx.fillRect(screenX - size * 0.33, y + size * 0.23, size * 0.1, size * 0.32);
  ctx.fillRect(screenX + size * 0.23, y + size * 0.23, size * 0.1, size * 0.32);

  ctx.fillStyle = "#cccccc";
  ctx.beginPath();
  ctx.arc(screenX, y + size * 0.08, size * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = enemy.chasing ? "red" : "#111111";
  ctx.beginPath(); ctx.arc(screenX - size * 0.05, y + size * 0.06, size * 0.02, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(screenX + size * 0.05, y + size * 0.06, size * 0.02, 0, Math.PI * 2); ctx.fill();
}

function drawMinimap() {
  const mTile = 10;
  const offsetX = 15;
  const offsetY = 70;

  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(offsetX, offsetY, map[0].length * mTile, map.length * mTile);

  for (let gy = 0; gy < map.length; gy++) {
    for (let gx = 0; gx < map[gy].length; gx++) {
      const cell = map[gy][gx];
      let px = offsetX + gx * mTile;
      let py = offsetY + gy * mTile;

      if (cell === "#") {
        ctx.fillStyle = "#555555";
        ctx.fillRect(px, py, mTile, mTile);
      } else if (cell === "A" || cell === "B" || cell === "C") {
        ctx.fillStyle = switches[cell] ? "#00ff00" : "#ffff00";
        ctx.fillRect(px + 2, py + 2, mTile - 4, mTile - 4);
      } else if (cell === "E") {
        ctx.fillStyle = (switches.A && switches.B && switches.C) ? "#00ffff" : "#ff00ff";
        ctx.fillRect(px + 1, py + 1, mTile - 2, mTile - 2);
      }
    }
  }

  let ex = offsetX + (enemy.x / TILE) * mTile;
  let ey = offsetY + (enemy.y / TILE) * mTile;
  ctx.fillStyle = enemy.chasing ? "red" : "orange";
  ctx.beginPath();
  ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
  ctx.fill();

  let px = offsetX + (player.x / TILE) * mTile;
  let py = offsetY + (player.y / TILE) * mTile;
  ctx.fillStyle = "#00ff00";
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#00ff00";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(player.angle) * 8, py + Math.sin(player.angle) * 8);
  ctx.stroke();
}

function endCurrentGame(title, desc) {
  playing = false;
  ingameMenuBtn.style.display = "none";
  if (currentMode === 'pc') document.exitPointerLock();
  
  menu.style.display = "flex";
  menuTitle.style.color = title === "ESCAPE" ? "#00ff00" : "red";
  menuTitle.textContent = title;
  menuText.innerHTML = desc + "<br><br>プレイするモードを選んでください。";
}

function finishGame() {
  endCurrentGame("ESCAPE", "脱出成功！すべてのスイッチを破壊し、生還した。");
}

function gameOver() {
  endCurrentGame("GAME OVER", "捕まった... 迷路の闇に消えていった。");
}

function loop() {
  if (playing && !isPaused) {
    updateCamera();
    movePlayer();
    moveEnemy();
    drawWorld();
    drawEnemy();
    drawMinimap();
  }
  requestAnimationFrame(loop);
}

loop();

window.onresize = () => {
  resizeCanvas();
};