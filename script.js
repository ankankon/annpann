const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = innerWidth;
canvas.height = innerHeight;

const TILE = 100;

// # = 壁
// S = スタート
// E = 出口
// A B C = スイッチ

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

let player = {
  x: TILE * 1.5,
  y: TILE * 1.5,
  angle: 0
};

let keys = {};

let switches = {
  A:false,
  B:false,
  C:false
};

let gameStarted = false;

const message = document.getElementById("message");

document.getElementById("startBtn").onclick = () => {
  gameStarted = true;
  document.getElementById("startScreen").style.display = "none";
};

addEventListener("keydown", e=>{
  keys[e.key.toLowerCase()] = true;
});

addEventListener("keyup", e=>{
  keys[e.key.toLowerCase()] = false;
});

function isWall(x,y){

  const gx = Math.floor(x / TILE);
  const gy = Math.floor(y / TILE);

  if(!map[gy]) return true;

  return map[gy][gx] === "#";
}

function update(){

  const moveSpeed = 3;
  const rotSpeed = 0.04;

  if(keys["a"]) player.angle -= rotSpeed;
  if(keys["d"]) player.angle += rotSpeed;

  let nx = player.x;
  let ny = player.y;

  if(keys["w"]){
    nx += Math.cos(player.angle) * moveSpeed;
    ny += Math.sin(player.angle) * moveSpeed;
  }

  if(keys["s"]){
    nx -= Math.cos(player.angle) * moveSpeed;
    ny -= Math.sin(player.angle) * moveSpeed;
  }

  if(!isWall(nx,ny)){
    player.x = nx;
    player.y = ny;
  }

  checkEvents();
}

function checkEvents(){

  const gx = Math.floor(player.x / TILE);
  const gy = Math.floor(player.y / TILE);

  const cell = map[gy][gx];

  if(cell === "A" && !switches.A){
    switches.A = true;
    showMessage("Aスイッチを押した");
  }

  if(cell === "B" && !switches.B){
    switches.B = true;
    showMessage("Bスイッチを押した");
  }

  if(cell === "C" && !switches.C){
    switches.C = true;
    showMessage("Cスイッチを押した");
  }

  if(cell === "E"){

    if(switches.A && switches.B && switches.C){

      showMessage("脱出成功");

      setTimeout(()=>{
        location.reload();
      },4000);

    }else{
      showMessage("出口が開かない...");
    }
  }
}

function showMessage(text){

  message.textContent = text;

  clearTimeout(message.timer);

  message.timer = setTimeout(()=>{
    message.textContent = "";
  },2000);
}

function draw3D(){

  // 空
  ctx.fillStyle = "#87ceeb";
  ctx.fillRect(0,0,canvas.width,canvas.height/2);

  // 地面
  ctx.fillStyle = "#444";
  ctx.fillRect(0,canvas.height/2,canvas.width,canvas.height/2);

  for(let i=0;i<canvas.width;i++){

    const rayAngle =
      player.angle - 0.5 + (i / canvas.width);

    let dist = 0;
    let hit = false;

    while(!hit && dist < 2000){

      dist += 2;

      const rx =
        player.x + Math.cos(rayAngle) * dist;

      const ry =
        player.y + Math.sin(rayAngle) * dist;

      if(isWall(rx,ry)){
        hit = true;
      }
    }

    // 魚眼補正
    const corrected =
      dist * Math.cos(rayAngle - player.angle);

    // 高い壁
    const wallHeight = 18000 / corrected;

    // 距離で暗くする
    const shade =
      Math.max(40, 255 - corrected / 4);

    ctx.fillStyle =
      `rgb(${shade},${shade},${shade})`;

    ctx.fillRect(
      i,
      canvas.height/2 - wallHeight/2,
      1,
      wallHeight
    );
  }
}

function loop(){

  if(gameStarted){

    update();

    draw3D();
  }

  requestAnimationFrame(loop);
}

loop();

onresize = () => {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
};