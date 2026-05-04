// 2048 game logic — pure, framework-free.

const SIZE = 4;

export class Game2048 {
  constructor(boardEl, onChange) {
    this.boardEl = boardEl;
    this.onChange = onChange || (() => {});
    this.tiles = []; // {id, value, row, col, merged?, isNew?}
    this.nextId = 1;
    this.score = 0;
    this.best = Number(localStorage.getItem("eye2048-best") || 0);
    this.over = false;
    this.won = false;
    this._buildCells();
    this.reset();
  }

  _buildCells() {
    this.boardEl.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const c = document.createElement("div");
      c.className = "cell";
      this.boardEl.appendChild(c);
    }
  }

  reset() {
    this.tiles = [];
    this.score = 0;
    this.over = false;
    this.won = false;
    this._spawn();
    this._spawn();
    this._render();
    requestAnimationFrame(() => this._render());
    this._emit();
  }

  _grid() {
    const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (const t of this.tiles) g[t.row][t.col] = t;
    return g;
  }

  _emptyCells() {
    const empties = [];
    const g = this._grid();
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!g[r][c]) empties.push([r, c]);
    return empties;
  }

  _spawn() {
    const empties = this._emptyCells();
    if (!empties.length) return false;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    this.tiles.push({
      id: this.nextId++,
      value: Math.random() < 0.9 ? 2 : 4,
      row: r,
      col: c,
      isNew: true,
    });
    return true;
  }

  // direction: 'up' | 'down' | 'left' | 'right'
  move(direction) {
    if (this.over) return false;

    // Clear transient flags
    for (const t of this.tiles) {
      t.merged = false;
      t.isNew = false;
    }

    const dir = direction;
    const traverse = this._traversal(dir);
    const vec = this._vector(dir);
    let moved = false;
    const grid = this._grid();
    const removed = new Set();

    for (const r of traverse.rows) {
      for (const c of traverse.cols) {
        const tile = grid[r][c];
        if (!tile) continue;

        let nr = r, nc = c;
        let nextR = r + vec.r, nextC = c + vec.c;
        while (this._inBounds(nextR, nextC) && !grid[nextR][nextC]) {
          nr = nextR; nc = nextC;
          nextR += vec.r; nextC += vec.c;
        }

        const target = this._inBounds(nextR, nextC) ? grid[nextR][nextC] : null;
        if (target && target.value === tile.value && !target.merged && !removed.has(target.id)) {
          // merge tile -> target
          target.value *= 2;
          target.merged = true;
          this.score += target.value;
          if (target.value === 2048 && !this.won) this.won = true;
          removed.add(tile.id);
          grid[r][c] = null;
          // tile slides into target's position visually
          tile.row = target.row;
          tile.col = target.col;
          moved = true;
        } else if (nr !== r || nc !== c) {
          tile.row = nr;
          tile.col = nc;
          grid[r][c] = null;
          grid[nr][nc] = tile;
          moved = true;
        }
      }
    }

    if (moved) {
      this.tiles = this.tiles.filter((t) => !removed.has(t.id));
      this._spawn();
      if (this.score > this.best) {
        this.best = this.score;
        localStorage.setItem("eye2048-best", String(this.best));
      }
      this._render();
      if (!this._hasMoves()) this.over = true;
      this._emit();
    }
    return moved;
  }

  _vector(dir) {
    return ({
      up: { r: -1, c: 0 },
      down: { r: 1, c: 0 },
      left: { r: 0, c: -1 },
      right: { r: 0, c: 1 },
    })[dir];
  }

  _traversal(dir) {
    const rows = [0, 1, 2, 3];
    const cols = [0, 1, 2, 3];
    if (dir === "down") rows.reverse();
    if (dir === "right") cols.reverse();
    return { rows, cols };
  }

  _inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  _hasMoves() {
    if (this._emptyCells().length) return true;
    const g = this._grid();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = g[r][c]?.value;
        if (r + 1 < SIZE && g[r + 1][c]?.value === v) return true;
        if (c + 1 < SIZE && g[r][c + 1]?.value === v) return true;
      }
    }
    return false;
  }

  _render() {
    // remove old tile elements
    this.boardEl.querySelectorAll(".tile").forEach((el) => el.remove());

    const rect = this.boardEl.getBoundingClientRect();
    const padding = 10;
    const gap = 10;
    const cellSize = (rect.width - padding * 2 - gap * (SIZE - 1)) / SIZE;

    for (const t of this.tiles) {
      const el = document.createElement("div");
      const cls = t.value <= 2048 ? `t-${t.value}` : "t-big";
      el.className = `tile ${cls}${t.isNew ? " new" : ""}${t.merged ? " merged" : ""}`;
      el.textContent = t.value;
      el.style.width = `${cellSize}px`;
      el.style.height = `${cellSize}px`;
      const x = padding + t.col * (cellSize + gap);
      const y = padding + t.row * (cellSize + gap);
      el.style.transform = `translate(${x}px, ${y}px)`;
      this.boardEl.appendChild(el);
    }
  }

  resize() { this._render(); }

  _emit() {
    this.onChange({
      score: this.score,
      best: this.best,
      over: this.over,
      won: this.won,
    });
  }
}
