const DEFAULT_PLACE_ID = "18687417158";
const STORAGE_KEY = "forsaken-update-tracker-state";

const form = document.querySelector("#lookup-form");
const input = document.querySelector("#game-input");
const statusBox = document.querySelector("#status");
const updated = document.querySelector("#updated");
const playing = document.querySelector("#playing");
const visits = document.querySelector("#visits");
const favorites = document.querySelector("#favorites");
const patchNotes = document.querySelector("#patch-notes");
const historyList = document.querySelector("#history");
const clearHistory = document.querySelector("#clear-history");

const numberFormat = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

function getSavedState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
}

function extractPlaceId(value) {
  const trimmed = value.trim();
  const urlMatch = trimmed.match(/roblox\.com\/games\/(\d+)/i);
  const numberMatch = trimmed.match(/^\d+$/);
  if (urlMatch) return urlMatch[1];
  if (numberMatch) return trimmed;
  return DEFAULT_PLACE_ID;
}

function extractPatchText(description = "") {
  const marker = description.match(/Newest Patch![\s\S]*?(?=\n\n[^\n]*\[\d|\n\n🏆|$)/i);
  if (marker) return marker[0].trim();

  const dated = description.match(/[^\n]*\[\d{1,2}-\d{1,2}\][\s\S]*?(?=\n\n|$)/);
  if (dated) return dated[0].trim();

  return "No patch text found in the Roblox description.";
}

function updateHistory(game) {
  const state = getSavedState();
  const previous = state.lastUpdated;
  const now = new Date().toISOString();
  const current = game.updated;
  const history = Array.isArray(state.history) ? state.history : [];

  if (!previous) {
    history.unshift({
      checkedAt: now,
      message: `Started tracking ${game.name}. Last Roblox update was ${dateFormat.format(new Date(current))}.`
    });
    setStatus("Tracking started. Refresh later to catch the next Roblox update.", "good");
  } else if (previous !== current) {
    history.unshift({
      checkedAt: now,
      message: `${game.name} updated on Roblox: ${dateFormat.format(new Date(previous))} -> ${dateFormat.format(new Date(current))}.`
    });
    setStatus("New Roblox update detected.", "alert");
  } else {
    history.unshift({
      checkedAt: now,
      message: `Checked ${game.name}; no new Roblox update since ${dateFormat.format(new Date(current))}.`
    });
    setStatus("No new Roblox update detected.", "good");
  }

  saveState({ lastUpdated: current, history: history.slice(0, 12) });
  renderHistory();
}

function renderHistory() {
  const state = getSavedState();
  const history = Array.isArray(state.history) ? state.history : [];
  historyList.innerHTML = "";

  if (!history.length) {
    const empty = document.createElement("li");
    empty.textContent = "No checks recorded yet.";
    historyList.append(empty);
    return;
  }

  for (const item of history) {
    const row = document.createElement("li");
    const time = document.createElement("time");
    time.dateTime = item.checkedAt;
    time.textContent = dateFormat.format(new Date(item.checkedAt));
    row.append(time, document.createTextNode(item.message));
    historyList.append(row);
  }
}

function renderGame(game) {
  updated.textContent = dateFormat.format(new Date(game.updated));
  playing.textContent = numberFormat.format(game.playing ?? 0);
  visits.textContent = numberFormat.format(game.visits ?? 0);
  favorites.textContent = numberFormat.format(game.favoritedCount ?? 0);
  patchNotes.textContent = extractPatchText(game.description);
}

async function refresh() {
  setStatus("Checking Roblox...", "");
  const placeId = extractPlaceId(input.value);
  const response = await fetch(`/api/game?placeId=${placeId}`);

  if (!response.ok) {
    const problem = await response.json().catch(() => ({ error: "Tracker helper is not responding." }));
    throw new Error(problem.error || "Tracker helper is not responding.");
  }

  const { game } = await response.json();
  renderGame(game);
  updateHistory(game);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await refresh();
  } catch (error) {
    setStatus(error.message, "bad");
  }
});

clearHistory.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  setStatus("History cleared. Refresh to start tracking again.");
});

renderHistory();
refresh().catch((error) => setStatus(error.message, "bad"));
