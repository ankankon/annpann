const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();

const TILE = 100;

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

// タイムアタック用変数
let startTime = 0;
let elapsedTime = 0;
let pauseStartTime = 0;
let totalPausedTime = 0;

let pauseSelectedIndex = 0;
const pauseButtons = document.getElementsByClassName("p-idx");

let touchMoveId = null, touchLookId = null;
let joyStart = { x: 0, y: 0 }, joyMove = { x: 0, y: 0 };
let lastLook = { x: 0, y: 0 };

let targetAngle = 0;
let targetPitch = 0;

const menu = document.getElementById("menu");
const menuTitle = document.getElementById("menu-title");
const menuText = document.getElementById("menu-text");
const pauseMenu = document.getElementById("pause-menu");
const ingameMenuBtn = document.getElementById("ingame-menu-btn");
const info = document.getElementById("info");
const timerDisplay = document.getElementById("timer-display");
const touchContainer = document.getElementById("touch-container");
const joyBase = document.getElementById("joystick-base");
const joyStick = document.getElementById("joystick-stick");

document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

resetGame();

function resetGame() {
  player = { x: startPlayer.x, y: startPlayer.y, angle: startPlayer.angle, pitch: 0 };
  targetAngle = startPlayer.angle;
  targetPitch = 0;
  enemy = { x: startEnemy.x, y: startEnemy.y, speed: 1.5, chasing: false, loseTimer: 0, dir: { x: -1, y: 0 } };
  switches = { A: false, B: false, C: false };
  
  // タイム初期化
  elapsedTime = 0;
  totalPausedTime = 0;
}

function startGame(mode) {
  currentMode = mode;
  resetGame();
  playing = true;
  isPaused = false;
  
  startTime = performance.now(); // 開始
  
  menu.style.display = "none";
  pauseMenu.style.display = "none";
  ingameMenuBtn.style.display = "block";
  timerDisplay.style.display = "block";
  
  if (currentMode === 'pc') {
    touchContainer.style.display = "none";
    canvas.requestPointerLock();
  } else {
    touchContainer.style.display = "block";
  }
  
  message("迷路に潜む恐怖から逃げろ...");
}

function openPauseMenu() {
  if (!playing || isPaused) return;
  isPaused = true;
  pauseStartTime = performance.now(); // ポーズ開始時刻
  pauseMenu.style.display = "flex";
  if (currentMode === 'pc') document.exitPointerLock();
  pauseSelectedIndex = 0;
  updatePauseMenuSelection();
}

function resumeGame() {
  isPaused = false;
  totalPausedTime += (performance.now() - pauseStartTime); // ポーズ時間を累計に加算
  pauseMenu.style.display = "none";
  if (currentMode === 'pc') canvas.requestPointerLock();
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
  timerDisplay.style.display = "none";
  touchContainer.style.display = "none";
  menu.style.display = "flex";
  menuTitle.style.color = "red";
  menuTitle.textContent = "DEATH MAZE";
  menuText.textContent = "操作モードを選択してください";
}

function updatePauseMenuSelection() {
  for (let i = 0; i < pauseButtons.length; i++) {
    pauseButtons[i].classList.toggle("selected", i === pauseSelectedIndex);
  }
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && playing && currentMode === 'pc' && !isPaused) {
    openPauseMenu();
  }
});

function message(text) {
  info.textContent = text;
  clearTimeout(info.timer);
  info.timer = setTimeout(() => info.textContent = "", 3000);
}

function normalizeAngle(angle) {
  while (angle < 0) angle += Math.PI * 2;
  while (angle >= Math.PI * 2) angle -= Math.PI * 2;
  return angle;
}

document.addEventListener("mousemove", e => {
  if (currentMode === 'pc' && document.pointerLockElement === canvas && !isPaused) {
    let deltaAngle = e.movementX * 0.0022;
    deltaAngle = Math.max(-0.08, Math.min(0.08, deltaAngle));
    targetAngle += deltaAngle;
    targetAngle = normalizeAngle(targetAngle);
    
    let deltaPitch = e.movementY * 1.5;
    deltaPitch = Math.max(-45, Math.min(45, deltaPitch));
    targetPitch -= deltaPitch;
    targetPitch = Math.max(-canvas.height / 2, Math.min(canvas.height / 2, targetPitch));
  }
});

window.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  keys[key] = true;
  if (playing && !isPaused && (e.key === "Escape" || key === "p")) {
    openPauseMenu();
    e.preventDefault();
  } else if (isPaused) {
    if (e.key === "Escape" || key === "p") resumeGame();
    if (key === "arrowup" || key === "w") { pauseSelectedIndex = (pauseSelectedIndex - 1 + pauseButtons.length) % pauseButtons.length; updatePauseMenuSelection(); }
    if (key === "arrowdown" || key === "s") { pauseSelectedIndex = (pauseSelectedIndex + 1) % pauseButtons.length; updatePauseMenuSelection(); }
    if (key === "enter") pauseButtons[pauseSelectedIndex].click();
    e.preventDefault();
  }
});

window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// タッチ操作（略：元のロジックを維持）
const leftZone = document.getElementById("left-zone");
leftZone.addEventListener("touchstart", e => {
  if (!playing || currentMode !== 'mobile' || isPaused) return;
  const touch = e.changedTouches[0];
  if (touchMoveId === null) {
    touchMoveId = touch.identifier;
    joyStart = { x: touch.clientX, y: touch.clientY };
    joyBase.style.display = "block";
    joyBase.style.left = joyStart.x + "px"; joyBase.style.top = joyStart.y + "px";
  }
}, { passive: false });

window.addEventListener("touchmove", e => {
  if (!playing || currentMode !== 'mobile' || isPaused) return;
  for (let touch of e.changedTouches) {
    if (touch.identifier === touchMoveId) {
      let dx = touch.clientX - joyStart.x, dy = touch.clientY - joyStart.y;
      const dist = Math.hypot(dx, dy), maxDist = 40;
      if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
      joyMove = { x: dx / maxDist, y: dy / maxDist };
      joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    if (touch.identifier === touchLookId) {
      let dx = touch.clientX - lastLook.x, dy = touch.clientY - lastLook.y;
      let deltaAngle = Math.max(-0.1, Math.min(0.1, dx * 0.005));
      targetAngle = normalizeAngle(targetAngle + deltaAngle);
      targetPitch = Math.max(-canvas.height / 2, Math.min(canvas.height / 2, targetPitch - dy * 1.8));
      lastLook = { x: touch.clientX, y: touch.clientY };
    }
  }
}, { passive: false });

const rightZone = document.getElementById("right-zone");
rightZone.addEventListener("touchstart", e => {
  if (!playing || currentMode !== 'mobile' || isPaused) return;
  const touch = e.changedTouches[0];
  if (touchLookId === null) { touchLookId = touch.identifier; lastLook = { x: touch.clientX, y: touch.clientY }; }
}, { passive: false });

window.addEventListener("touchend", e => {
  for (let touch of e.changedTouches) {
    if (touch.identifier === touchMoveId) { touchMoveId = null; joyMove = { x: 0, y: 0 }; joyBase.style.display = "none"; }
    if (touch.identifier === touchLookId) touchLookId = null;
  }
});

function updateCamera() {
  let diffAngle = targetAngle - player.angle;
  while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
  while (diffAngle > Math.PI)  diffAngle -= Math.PI * 2;
  player.angle = normalizeAngle(player.angle + diffAngle * 0.35);
  player.pitch += (targetPitch - player.pitch) * 0.35;
}

function isWall(x, y) {
  const gx = Math.floor(x / TILE), gy = Math.floor(y / TILE);
  return !map[gy] || !map[gy][gx] || map[gy][gx] === "#";
}

function canSeePlayer() {
  let dx = player.x - enemy.x, dy = player.y - enemy.y, dist = Math.hypot(dx, dy), steps = dist / 5;
  for (let i = 0; i < steps; i++) {
    if (isWall(enemy.x + dx * (i / steps), enemy.y + dy * (i / steps))) return false;
  }
  return true;
}

function movePlayer() {
  const speed = 3.5;
  let moveX = 0, moveY = 0;
  if (currentMode === 'pc') {
    if (keys["w"]) { moveX += Math.cos(player.angle); moveY += Math.sin(player.angle); }
    if (keys["s"]) { moveX -= Math.cos(player.angle); moveY -= Math.sin(player.angle); }
    if (keys["a"]) { moveX += Math.cos(player.angle - Math.PI / 2); moveY += Math.sin(player.angle - Math.PI / 2); }
    if (keys["d"]) { moveX += Math.cos(player.angle + Math.PI / 2); moveY += Math.sin(player.angle + Math.PI / 2); }
  } else if (touchMoveId !== null) {
    moveX += Math.cos(player.angle) * (-joyMove.y) + Math.cos(player.angle + Math.PI / 2) * joyMove.x;
    moveY += Math.sin(player.angle) * (-joyMove.y) + Math.sin(player.angle + Math.PI / 2) * joyMove.x;
  }
  const len = Math.hypot(moveX, moveY);
  if (len > 0) {
    let nx = player.x + (moveX / len) * speed, ny = player.y + (moveY / len) * speed;
    if (!isWall(nx, player.y)) player.x = nx;
    if (!isWall(player.x, ny)) player.y = ny;
  }
  checkEvents();
}

function moveEnemy() {
  if (canSeePlayer()) {
    if (!enemy.chasing) message("見つかった！！！");
    enemy.chasing = true; enemy.loseTimer = 0;
  } else if (enemy.chasing && ++enemy.loseTimer > 240) {
    enemy.chasing = false; message("撒いたようだ...");
  }

  if (enemy.chasing) {
    let dx = player.x - enemy.x, dy = player.y - enemy.y, dist = Math.hypot(dx, dy);
    let currentSpeed = enemy.speed * 1.35;
    let nx = enemy.x + (dx / dist) * currentSpeed, ny = enemy.y + (dy / dist) * currentSpeed;
    if (!isWall(nx, enemy.y)) enemy.x = nx;
    if (!isWall(enemy.x, ny)) enemy.y = ny;
    if (dist < 25) gameOver();
  } else {
    // 巡回ロジック
    if (Math.abs((enemy.x % TILE) - TILE / 2) < 5 && Math.abs((enemy.y % TILE) - TILE / 2) < 5) {
      let gx = Math.floor(enemy.x / TILE), gy = Math.floor(enemy.y / TILE);
      let dirs = DIRECTIONS.filter(d => map[gy+d.y] && map[gy+d.y][gx+d.x] !== "#");
      if (dirs.length > 1) dirs = dirs.filter(d => !(d.x === -enemy.dir.x && d.y === -enemy.dir.y));
      if (dirs.length > 0) enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
    }
    let nx = enemy.x + enemy.dir.x * enemy.speed, ny = enemy.y + enemy.dir.y * enemy.speed;
    if (!isWall(nx, ny)) { enemy.x = nx; enemy.y = ny; }
    else {
      enemy.x = (Math.floor(enemy.x / TILE) + 0.5) * TILE; enemy.y = (Math.floor(enemy.y / TILE) + 0.5) * TILE;
      let gx = Math.floor(enemy.x / TILE), gy = Math.floor(enemy.y / TILE);
      let dirs = DIRECTIONS.filter(d => map[gy+d.y] && map[gy+d.y][gx+d.x] !== "#");
      if(dirs.length > 0) enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
    }
  }
}

function checkEvents() {
  const gx = Math.floor(player.x / TILE), gy = Math.floor(player.y / TILE);
  const cell = map[gy] ? map[gy][gx] : null;
  if (cell === "A" && !switches.A) { switches.A = true; message("【A】スイッチ起動！"); }
  if (cell === "B" && !switches.B) { switches.B = true; message("【B】スイッチ起動！"); }
  if (cell === "C" && !switches.C) { switches.C = true; message("【C】スイッチ起動！"); }
  if (cell === "E") {
    if (switches.A && switches.B && switches.C) finishGame();
    else message("出口がロックされている...");
  }
}

function drawWorld() {
  const horizon = canvas.height / 2 + player.pitch, fov = 1.0;
  ctx.fillStyle = "#111a24"; ctx.fillRect(0, 0, canvas.width, horizon);
  ctx.fillStyle = "#222222"; ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);

  for (let i = 0; i < canvas.width; i++) {
    let rayAngle = player.angle - (fov / 2) + (i / canvas.width) * fov;
    let dist = 0, hit = false;
    while (!hit && dist < 1200) {
      dist += 1.5;
      if (isWall(player.x + Math.cos(rayAngle) * dist, player.y + Math.sin(rayAngle) * dist)) hit = true;
    }
    let corrected = dist * Math.cos(rayAngle - player.angle);
    let wallHeight = (22000 / Math.max(1, corrected)) * (canvas.height / 600);
    let shade = Math.max(20, 200 - corrected / 4);
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ctx.fillRect(i, horizon - wallHeight / 2, 1, wallHeight);
  }
}

function drawEnemy() {
  let dx = enemy.x - player.x, dy = enemy.y - player.y, dist = Math.hypot(dx, dy);
  let angle = Math.atan2(dy, dx), relative = angle - player.angle;
  while (relative < -Math.PI) relative += Math.PI * 2;
  while (relative > Math.PI)  relative -= Math.PI * 2;
  if (Math.abs(relative) > 0.65) return;
  
  let checkDist = 0;
  while (checkDist < dist) {
    checkDist += 4;
    if (isWall(player.x + Math.cos(angle) * checkDist, player.y + Math.sin(angle) * checkDist)) return;
  }

  let screenX = (relative + 0.65) / 1.3 * canvas.width;
  let size = (9000 / dist) * (canvas.height / 600);
  let horizon = canvas.height / 2 + player.pitch, y = horizon - size / 2;

  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.ellipse(screenX, y + size * 0.95, size * 0.28, size * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0a0a0a"; ctx.fillRect(screenX - size * 0.15, y + size * 0.55, size * 0.1, size * 0.35); ctx.fillRect(screenX + size * 0.05, y + size * 0.55, size * 0.1, size * 0.35);
  ctx.fillStyle = enemy.chasing ? "#660000" : "#1f1f1f"; ctx.fillRect(screenX - size * 0.22, y + size * 0.2, size * 0.44, size * 0.45);
  ctx.fillStyle = "#cccccc"; ctx.beginPath(); ctx.arc(screenX, y + size * 0.08, size * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = enemy.chasing ? "red" : "#111111";
  ctx.beginPath(); ctx.arc(screenX - size * 0.05, y + size * 0.06, size * 0.02, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(screenX + size * 0.05, y + size * 0.06, size * 0.02, 0, Math.PI * 2); ctx.fill();
}

function drawMinimap() {
  const mTile = 10, offsetX = 15, offsetY = 70;
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; ctx.fillRect(offsetX, offsetY, map[0].length * mTile, map.length * mTile);
  for (let gy = 0; gy < map.length; gy++) {
    for (let gx = 0; gx < map[gy].length; gx++) {
      const cell = map[gy][gx];
      if (cell === "#") { ctx.fillStyle = "#555555"; ctx.fillRect(offsetX + gx * mTile, offsetY + gy * mTile, mTile, mTile); }
      else if ("ABC".includes(cell)) { ctx.fillStyle = switches[cell] ? "#00ff00" : "#ffff00"; ctx.fillRect(offsetX + gx * mTile + 2, offsetY + gy * mTile + 2, mTile - 4, mTile - 4); }
      else if (cell === "E") { ctx.fillStyle = (switches.A && switches.B && switches.C) ? "#00ffff" : "#ff00ff"; ctx.fillRect(offsetX + gx * mTile + 1, offsetY + gy * mTile + 1, mTile - 2, mTile - 2); }
    }
  }
  ctx.fillStyle = enemy.chasing ? "red" : "orange"; ctx.beginPath(); ctx.arc(offsetX + (enemy.x/TILE)*mTile, offsetY + (enemy.y/TILE)*mTile, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#00ff00"; ctx.beginPath(); ctx.arc(offsetX + (player.x/TILE)*mTile, offsetY + (player.y/TILE)*mTile, 3, 0, Math.PI*2); ctx.fill();
}

function endCurrentGame(title, desc) {
  playing = false;
  ingameMenuBtn.style.display = "none";
  timerDisplay.style.display = "none";
  if (currentMode === 'pc') document.exitPointerLock();
  menu.style.display = "flex";
  menuTitle.style.color = title === "ESCAPE" ? "#00ff00" : "red";
  menuTitle.textContent = title;
  menuText.innerHTML = desc + "<br><br>プレイするモードを選んでください。";
}

function finishGame() {
  const finalTime = elapsedTime.toFixed(2);
  endCurrentGame("ESCAPE", `脱出成功！<br>記録: ${finalTime} 秒`);
}

function gameOver() {
  endCurrentGame("GAME OVER", "捕まった... 迷路の闇に消えていった。");
}

function loop() {
  if (playing && !isPaused) {
    // タイム更新（現在時刻 - 開始時刻 - 合計ポーズ時間）
    elapsedTime = (performance.now() - startTime - totalPausedTime) / 1000;
    timerDisplay.textContent = `TIME: ${elapsedTime.toFixed(2)}s`;

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
window.onresize = resizeCanvas;