const SGR = { dim: "2", green: "32", red: "31" };

// One row of styled segments, cut to `width` cells.
function line(segments, width) {
  let s = "";
  let left = width;
  for (const [text, style] of segments) {
    if (left <= 0) break;
    const t = text.length > left ? `${text.slice(0, Math.max(0, left - 1))}…` : text;
    left -= t.length;
    s += `\x1b[${[0, style && SGR[style]].filter(Boolean).join(";")}m${t}`;
  }
  return `${s}\x1b[0m`;
}

function wrap(text, width) {
  const lines = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if (current && current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines;
}

// Where things go, in cells (1-based rows and columns) and in the terminal's
// pixels, which are the mouse's units: the status line on the last row, and
// above it the screen, as large as fits, centered.
export function layout({ cols, rows, cellWidth, cellHeight }, frame) {
  const area = { row: 1, rows: Math.max(0, rows - 1), x: 0, y: 0, width: cols * cellWidth, height: Math.max(0, rows - 1) * cellHeight };
  let screen = null;
  if (frame && area.rows > 0) {
    const scale = Math.min(area.width / frame.width, area.height / frame.height);
    const width = Math.max(1, Math.floor(frame.width * scale));
    const height = Math.max(1, Math.floor(frame.height * scale));
    const col = Math.floor((area.width - width) / 2 / cellWidth);
    const row = area.row + Math.floor((area.height - height) / 2 / cellHeight);
    screen = { row, col, x: col * cellWidth, y: (row - 1) * cellHeight, width, height };
  }
  return { cols, rows, cellWidth, cellHeight, area, screen };
}

// The view's text, for the area above the status line.
function message(view) {
  switch (view.kind) {
    case "empty": return "Press Ctrl-P to pick a device";
    case "connecting": return `Connecting to ${view.device.name}…`;
    case "booting": return `Booting ${view.device.name}…`;
    case "message":
    case "error": return view.text;
    case "streaming": return null;
  }
}

export const fraction = (rect, e) => ({ x: (e.x - rect.x) / rect.width, y: (e.y - rect.y) / rect.height });

export const hit = (regions, e) => regions.find((r) => e.x >= r.x0 && e.x < r.x1 && e.y >= r.y0 && e.y < r.y1);

// state: { view, device (this pane's), notice }
// -> the area's rows (null while the screen shows there), the status line,
// and the regions a click can hit, in pixels, each with `run(mouseEvent)`.
export function render(state, geometry, actions) {
  const { view, device } = state;
  const { cols, cellWidth: cw, cellHeight: ch, area } = geometry;
  const regions = [];
  const streaming = view.kind === "streaming";

  let rows = null;
  if (streaming) {
    const screen = geometry.screen;
    if (screen) {
      regions.push({
        x0: screen.x, y0: screen.y, x1: screen.x + screen.width, y1: screen.y + screen.height,
        run: (e) => {
          const p = fraction(screen, e);
          if (e.action === "wheel") actions.scroll(e.dy, p);
          else if (e.action === "press" && e.button === 0) actions.touch(p);
        },
      });
    }
  } else {
    const lines = wrap(message(view), Math.max(10, cols - 4));
    const top = Math.max(0, Math.floor((area.rows - lines.length) / 2));
    rows = Array.from({ length: Math.min(area.rows, top + lines.length) }, (_, i) => {
      const t = lines[i - top];
      return t ? line([[" ".repeat(Math.max(0, Math.floor((cols - t.length) / 2)))], [t, view.kind === "error" ? "red" : "dim"]], cols) : "";
    });
  }

  // The device on the status line, which picks a device like Ctrl-P.
  const dot = streaming ? "green" : view.kind === "error" ? "red" : "dim";
  const label = device ? `${device.name} · ${device.os}` : "Select device";
  const statusY = (geometry.rows - 1) * ch;
  regions.push({ x0: 0, y0: statusY, x1: (label.length + 5) * cw, y1: statusY + ch, run: (e) => e.action === "press" && actions.pickDevice() });
  const status = line([[" "], ["●", dot], [` ${label} ▾`], [`   ${[state.notice, "ctrl-p devices · ctrl-c quit"].filter(Boolean).join(" · ")}`, "dim"]], cols - 1);
  return { area: rows, status, regions };
}
