/**
 * TokenVeda — Smart Clinic Queue System
 * Backend: Express + Socket.io
 *
 * In-memory queue engine. Swap the `store` object for a DB (SQLite/Postgres)
 * later without touching the socket/API contract.
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { v4: uuid } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
const store = {
  nextTokenNumber: 1,
  avgConsultMinutes: 8,
  currentToken: null, // { id, tokenNumber, name, calledAt }
  queue: [], // [{ id, tokenNumber, name, addedAt, priority }]
  history: [], // completed tokens: { id, tokenNumber, name, calledAt, completedAt }
  clinicName: "Sunrise Family Clinic",
};

function publicState() {
  return {
    clinicName: store.clinicName,
    avgConsultMinutes: store.avgConsultMinutes,
    currentToken: store.currentToken,
    queue: store.queue.map((p, idx) => ({
      ...p,
      position: idx + 1,
      estimatedWaitMinutes: (idx + 1) * store.avgConsultMinutes,
    })),
    queueLength: store.queue.length,
    totalServedToday: store.history.length,
    updatedAt: Date.now(),
  };
}

function broadcast() {
  io.emit("state", publicState());
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

// Full current state (used on page load before socket connects)
app.get("/api/state", (req, res) => {
  res.json(publicState());
});

// Add a new patient -> issues a token
app.post("/api/patients", (req, res) => {
  const { name, priority } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Patient name is required" });
  }

  const patient = {
    id: uuid(),
    tokenNumber: store.nextTokenNumber++,
    name: name.trim(),
    addedAt: Date.now(),
    priority: !!priority, // e.g. elderly / emergency fast-track
  };

  if (patient.priority) {
    // priority patients go right after whoever is currently being served,
    // i.e. to the front of the waiting queue
    store.queue.unshift(patient);
  } else {
    store.queue.push(patient);
  }

  broadcast();
  res.status(201).json(patient);
});

// Call the next token
app.post("/api/call-next", (req, res) => {
  if (store.currentToken) {
    store.history.push({ ...store.currentToken, completedAt: Date.now() });
  }

  const next = store.queue.shift();
  store.currentToken = next
    ? { ...next, calledAt: Date.now() }
    : null;

  broadcast();
  res.json(publicState());
});

// Recall current token (e.g. patient didn't respond, ring again)
app.post("/api/recall", (req, res) => {
  if (store.currentToken) {
    store.currentToken.calledAt = Date.now();
  }
  broadcast();
  res.json(publicState());
});

// Skip current patient -> sends them to the back of the queue
app.post("/api/skip", (req, res) => {
  if (store.currentToken) {
    store.queue.push({ ...store.currentToken, addedAt: Date.now() });
    store.currentToken = null;
  }
  broadcast();
  res.json(publicState());
});

// Update average consultation time (minutes) -> recalculates all ETAs
app.post("/api/avg-time", (req, res) => {
  const { minutes } = req.body;
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) {
    return res.status(400).json({ error: "minutes must be a positive number" });
  }
  store.avgConsultMinutes = m;
  broadcast();
  res.json(publicState());
});

// Remove a patient from the queue (no-show / cancelled)
app.delete("/api/patients/:id", (req, res) => {
  store.queue = store.queue.filter((p) => p.id !== req.params.id);
  broadcast();
  res.json(publicState());
});

// Reset the whole day (new clinic day)
app.post("/api/reset", (req, res) => {
  store.nextTokenNumber = 1;
  store.currentToken = null;
  store.queue = [];
  store.history = [];
  broadcast();
  res.json(publicState());
});

// ---------------------------------------------------------------------------
// Socket.io — live sync
// ---------------------------------------------------------------------------
io.on("connection", (socket) => {
  socket.emit("state", publicState());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`TokenVeda running at http://localhost:${PORT}`);
  console.log(`Receptionist: http://localhost:${PORT}/receptionist.html`);
  console.log(`Waiting room: http://localhost:${PORT}/waiting-room.html`);
});
