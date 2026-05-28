const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const fs = require("fs");

const app = express();

// ─── MongoDB Connection ───────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/gminsta";

let mongoConnected = false;

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    mongoConnected = true;
    console.log('✅ MongoDB connected to "gminsta" database');
  })
  .catch((err) => {
    mongoConnected = false;
    console.error("⚠️  MongoDB connection warning:", err.message);
    console.log("📝 App will run with limited functionality without MongoDB");
  });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Serve uploaded images
const uploadDir = path.join(__dirname, "public/images/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Session configuration with fallback
const sessionConfig = {
  secret: "gminsta-secret-key-2026",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
};

if (mongoConnected) {
  sessionConfig.store = MongoStore.create({ mongoUrl: MONGO_URI });
}

app.use(session(sessionConfig));

// ─── View Engine ─────────────────────────────────────────────────────────────
app.set("view engine", "html");

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

// ─── PUBLIC PAGES ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/home");
  res.sendFile(path.join(__dirname, "views/login.html"));
});

app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "views/login.html")),
);
app.get("/register", (req, res) =>
  res.sendFile(path.join(__dirname, "views/register.html")),
);

// ─── AUTHENTICATED PAGES ──────────────────────────────────────────────────────
// Original pages
app.get("/splash", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/splash.html")),
);
app.get("/home", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/home.html")),
);
app.get("/profile", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/profile.html")),
);
app.get("/chat", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/chat.html")),
);

// Followers/Following/Reels
app.get("/search", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/discover.html")),
);
app.get("/discover", requireAuth, (req, res) => res.redirect("/search"));
app.get("/reels", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/reels.html")),
);
app.get("/user/:userId", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/user-profile.html")),
);

// Stories & Settings
app.get("/stories", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/stories.html")),
);
app.get("/notes", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/notes.html")),
);
app.get("/settings", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/settings.html")),
);

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/posts", require("./routes/postRoutes"));
app.use("/api/comments", require("./routes/commentRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/stories", require("./routes/storyRoutes"));
app.use("/api/notes", require("./routes/noteRoutes"));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    mongodb: mongoConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 GMinsta running at http://0.0.0.0:${PORT}`);
  console.log(`
╔════════════════════════════════════════════════════════╗
║        GMinsta - Instagram-Like Social App             ║
╠════════════════════════════════════════════════════════╣
║  🏠 Home        - Create posts and view feed           ║
║  🔍 Search      - Find users, posts and reels          ║
║  📹 Reels       - Instagram-style vertical scrolling   ║
║  📖 Stories     - 24-hour temporary posts              ║
║  👤 Profile     - Your profile & pictures              ║
║  💬 Chat        - Message & share with others          ║
║  ⚙️  Settings   - Account & appearance settings        ║
║                                                        ║
║  Features:                                             ║
║  ✓ Dark Mode  ✓ Change Password  ✓ File Sharing      ║
║  ✓ Followers  ✓ Stories          ✓ Reel Sharing      ║
║  ✓ Profile Pictures  ✓ Comments  ✓ Notifications     ║
╚════════════════════════════════════════════════════════╝
  `);
});

