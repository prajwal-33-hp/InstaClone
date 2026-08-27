const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const fs = require("fs");

const app = express();

// ─── MongoDB Connection ───────────────────────────────────────────────────────

const MONGO_URI =
  "mongodb+srv://prajwalprajwal5674_db_user:9BbH5Yh8bEX66Rex@cluster0.fm3wma8.mongodb.net/gminsta?appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected to "gminsta" database');

    // Create collections if they don't already exist
    const collections = [
      "users",
      "posts",
      "comments",
      "stories",
      "notes",
    ];

    for (const collection of collections) {
      try {
        await mongoose.connection.createCollection(collection);
        console.log(`✅ ${collection} collection created`);
      } catch (error) {
        // Collection already exists
        if (error.codeName === "NamespaceExists") {
          console.log(`ℹ️ ${collection} collection already exists`);
        } else {
          console.error(
            `❌ Error creating ${collection} collection:`,
            error.message
          );
        }
      }
    }

    console.log("✅ MongoDB setup completed");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

// ─── Upload Directory ─────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, "public/images/uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ─── Session ──────────────────────────────────────────────────────────────────

app.use(
  session({
    secret: "gminsta-secret-key-2026",
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: MONGO_URI,
    }),

    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// ─── View Engine ──────────────────────────────────────────────────────────────

app.set("view engine", "html");

// ─── Auth Middleware ──────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  next();
}

// ─── PUBLIC PAGES ─────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/home");
  }

  res.sendFile(path.join(__dirname, "views/login.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views/login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views/register.html"));
});

// ─── AUTHENTICATED PAGES ──────────────────────────────────────────────────────

app.get("/splash", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views/splash.html"));
});

app.get("/home", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views/home.html"));
});

app.get("/profile", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views/profile.html"));
});

app.get("/chat", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views/chat.html"));
});

// ─── SEARCH / DISCOVER / REELS ────────────────────────────────────────────────

app.get("/search", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views/discover.html"));
});

app.get("/discover", requireAuth, (req, res) => {
  res.redirect("/search");
});

app.get("/reels", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views/reels.html"));
});

app.get("/user/:userId", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views/user-profile.html"));
});

// ─── STORIES / NOTES / SETTINGS ───────────────────────────────────────────────

app.get("/stories", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views/stories.html"));
});

app.get("/notes", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views/notes.html"));
});

app.get("/settings", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views/settings.html"));
});

// ─── API ROUTES ───────────────────────────────────────────────────────────────

app.use("/api/auth", require("./routes/authRoutes"));

app.use("/api/posts", require("./routes/postRoutes"));

app.use("/api/comments", require("./routes/commentRoutes"));

app.use("/api/chat", require("./routes/chatRoutes"));

app.use("/api/stories", require("./routes/storyRoutes"));

app.use("/api/notes", require("./routes/noteRoutes"));

// ─── START SERVER ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 GMinsta running at http://localhost:${PORT}`);

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
║  ⚙️  Settings   - Account & appearance                 ║
║                                                        ║
║  Features:                                             ║
║  ✓ Dark Mode  ✓ Change Password  ✓ File Sharing       ║
║  ✓ Followers  ✓ Stories          ✓ Reel Sharing       ║
║  ✓ Profile Pictures  ✓ Comments  ✓ Notifications      ║
╚════════════════════════════════════════════════════════╝
  `);
});
