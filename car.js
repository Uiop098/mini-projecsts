(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const overlay = document.getElementById("overlay");
  const titleEl = document.getElementById("title");
  const msgEl = document.getElementById("msg");
  const startBtn = document.getElementById("startBtn");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const speedEl = document.getElementById("speed");

  const LANES = 4;
  const ROAD_X = 40;
  const ROAD_W = W - ROAD_X * 2;
  const LANE_W = ROAD_W / LANES;
  const CAR_W = 38;
  const CAR_H = 70;

  let best = 0;
  try { best = parseInt(localStorage.getItem("roadrush-best") || "0", 10); } catch (e) {}
  bestEl.textContent = best;

  const keys = { left: false, right: false };
  let state = "menu"; // menu | playing | paused | over
  let player, enemies, score, speed, spawnTimer, lineOffset, lastTime;

  const COLORS = ["#e63946", "#2a9d8f", "#f4a261", "#9b5de5", "#4cc9f0", "#90be6d"];

  function reset() {
    player = { x: W / 2 - CAR_W / 2, y: H - CAR_H - 30, vx: 0 };
    enemies = [];
    score = 0;
    speed = 220; // px per second
    spawnTimer = 0;
    lineOffset = 0;
  }

  function drawCar(x, y, color, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    // body
    ctx.fillStyle = color;
    roundRect(0, 0, CAR_W, CAR_H, 8);
    ctx.fill();
    // windows
    ctx.fillStyle = "rgba(20,30,50,0.85)";
    roundRect(5, isPlayer ? 14 : 28, CAR_W - 10, 16, 4);
    ctx.fill();
    roundRect(7, isPlayer ? 46 : 8, CAR_W - 14, 12, 3);
    ctx.fill();
    // wheels
    ctx.fillStyle = "#111";
    ctx.fillRect(-3, 10, 4, 14);
    ctx.fillRect(CAR_W - 1, 10, 4, 14);
    ctx.fillRect(-3, CAR_H - 24, 4, 14);
    ctx.fillRect(CAR_W - 1, CAR_H - 24, 4, 14);
    // lights
    if (isPlayer) {
      ctx.fillStyle = "#fff6a8";
      ctx.fillRect(4, 2, 8, 4);
      ctx.fillRect(CAR_W - 12, 2, 8, 4);
    } else {
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(4, CAR_H - 6, 8, 4);
      ctx.fillRect(CAR_W - 12, CAR_H - 6, 8, 4);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawRoad() {
    // grass
    ctx.fillStyle = "#2d6a4f";
    ctx.fillRect(0, 0, W, H);
    // road
    ctx.fillStyle = "#3a3f4b";
    ctx.fillRect(ROAD_X, 0, ROAD_W, H);
    // edges
    ctx.fillStyle = "#f1f1f1";
    ctx.fillRect(ROAD_X - 4, 0, 4, H);
    ctx.fillRect(ROAD_X + ROAD_W, 0, 4, H);
    // lane dashes
    ctx.fillStyle = "#d8d8d8";
    for (let l = 1; l < LANES; l++) {
      const lx = ROAD_X + l * LANE_W - 2;
      for (let y = -60 + lineOffset; y < H; y += 60) {
        ctx.fillRect(lx, y, 4, 30);
      }
    }
  }

  function spawnEnemy() {
    const lane = Math.floor(Math.random() * LANES);
    const x = ROAD_X + lane * LANE_W + (LANE_W - CAR_W) / 2;
    // avoid stacking on top of a recent car in same lane
    if (enemies.some(e => Math.abs(e.x - x) < 5 && e.y < CAR_H * 2)) return;
    enemies.push({
      x,
      y: -CAR_H - 10,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rel: 0.35 + Math.random() * 0.4 // enemy moves slower than the road scroll
    });
  }

  function hit(a, b) {
    return (
      a.x + 4 < b.x + CAR_W - 4 &&
      a.x + CAR_W - 4 > b.x + 4 &&
      a.y + 4 < b.y + CAR_H - 4 &&
      a.y + CAR_H - 4 > b.y + 4
    );
  }

  function update(dt) {
    speed = Math.min(220 + score * 0.9, 700);

    // steering
    const accel = 1800;
    const maxV = 340;
    if (keys.left) player.vx -= accel * dt;
    if (keys.right) player.vx += accel * dt;
    if (!keys.left && !keys.right) player.vx *= Math.pow(0.0005, dt);
    player.vx = Math.max(-maxV, Math.min(maxV, player.vx));
    player.x += player.vx * dt;
    const minX = ROAD_X + 2;
    const maxX = ROAD_X + ROAD_W - CAR_W - 2;
    if (player.x < minX) { player.x = minX; player.vx = 0; }
    if (player.x > maxX) { player.x = maxX; player.vx = 0; }

    lineOffset = (lineOffset + speed * dt) % 60;

    // spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = Math.max(0.35, 1.0 - speed / 900) * (0.6 + Math.random() * 0.6);
    }

    // move enemies
    for (const e of enemies) {
      e.y += speed * (1 - e.rel * 0.5) * dt;
      if (hit(player, e)) return gameOver();
    }
    enemies = enemies.filter(e => e.y < H + CAR_H);

    score += (speed / 60) * dt * 6;
    scoreEl.textContent = Math.floor(score);
    speedEl.textContent = Math.floor(speed / 4);
  }

  function render() {
    drawRoad();
    for (const e of enemies) drawCar(e.x, e.y, e.color, false);
    drawCar(player.x, player.y, "#ffd23f", true);
  }

  function loop(t) {
    if (state !== "playing") return;
    const dt = Math.min((t - lastTime) / 1000, 0.05);
    lastTime = t;
    update(dt);
    if (state === "playing") {
      render();
      requestAnimationFrame(loop);
    }
  }

  function startGame() {
    reset();
    state = "playing";
    overlay.style.display = "none";
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state = "over";
    const final = Math.floor(score);
    if (final > best) {
      best = final;
      bestEl.textContent = best;
      try { localStorage.setItem("roadrush-best", String(best)); } catch (e) {}
    }
    render();
    titleEl.textContent = "Crash!";
    msgEl.textContent = "Score: " + final + (final >= best ? "  (new best!)" : "");
    startBtn.textContent = "Play again";
    overlay.style.display = "flex";
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      titleEl.textContent = "Paused";
      msgEl.textContent = "Press P or Resume to continue.";
      startBtn.textContent = "Resume";
      overlay.style.display = "flex";
    } else if (state === "paused") {
      state = "playing";
      overlay.style.display = "none";
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  // input
  window.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
    if (e.key === "p" || e.key === "P") togglePause();
    if (e.key === "Enter" && state !== "playing" && state !== "paused") startGame();
    if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  });
  window.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  });

  function hold(id, dir) {
    const el = document.getElementById(id);
    const on = ev => { ev.preventDefault(); keys[dir] = true; };
    const off = ev => { ev.preventDefault(); keys[dir] = false; };
    el.addEventListener("touchstart", on, { passive: false });
    el.addEventListener("touchend", off, { passive: false });
    el.addEventListener("touchcancel", off, { passive: false });
    el.addEventListener("mousedown", on);
    el.addEventListener("mouseup", off);
    el.addEventListener("mouseleave", off);
  }
  hold("leftBtn", "left");
  hold("rightBtn", "right");

  startBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else startGame();
  });

  // initial frame
  reset();
  render();
})();
