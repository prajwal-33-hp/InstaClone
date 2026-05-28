const express = require("express");
const router = express.Router();
const Note = require("../models/Note");
const User = require("../models/User");

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated." });
  next();
}

// ── Create Note ───────────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, content, color, isPublic, sharedWith } = req.body;
    if (!content || !content.trim())
      return res.status(400).json({ error: "Note content is required." });

    const note = new Note({
      userId: req.session.userId,
      title: title || "",
      content: content.trim(),
      color: color || "#2b303b",
      isPublic: isPublic === undefined ? true : (isPublic === true || isPublic === "true"),
      sharedWith: Array.isArray(sharedWith) ? sharedWith : [],
    });
    await note.save();
    await note.populate("userId", "username profilePic");
    res.json(note);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Feed: my notes + public notes + notes shared with me ─────────────────────
router.get("/feed", requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const notes = await Note.find({
      $or: [
        { userId: uid },
        { isPublic: true },
        { sharedWith: uid },
      ],
    })
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .lean();

    const me = uid.toString();
    res.json(notes.map((n) => ({
      ...n,
      likesCount: (n.likes || []).length,
      likedByMe: (n.likes || []).map(String).includes(me),
      isMine: n.userId._id.toString() === me,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── My Notes ──────────────────────────────────────────────────────────────────
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.session.userId })
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic")
      .lean();
    res.json(notes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── Public notes by user (for profile note bubble) ───────────────────────────
router.get("/user/:userId", requireAuth, async (req, res) => {
  try {
    const notes = await Note.find({
      userId: req.params.userId,
      $or: [{ isPublic: true }, { userId: req.session.userId }, { sharedWith: req.session.userId }],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .lean();

    const me = req.session.userId.toString();
    res.json(notes.map(n => ({
      ...n,
      likesCount: (n.likes || []).length,
      likedByMe: (n.likes || []).map(String).includes(me),
      isMine: n.userId && n.userId._id.toString() === me,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── React (toggle like) on a note ────────────────────────────────────────────
router.post("/:id/react", requireAuth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found." });

    const uid = req.session.userId;
    const liked = note.likes.map(String).includes(uid.toString());
    if (liked) note.likes.pull(uid);
    else note.likes.push(uid);

    await note.save();
    res.json({ liked: !liked, likesCount: note.likes.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Comment on a note ────────────────────────────────────────────────────────
router.post("/:id/comment", requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "Comment text required." });

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found." });

    note.comments.push({ userId: req.session.userId, text: text.trim() });
    await note.save();
    await note.populate("comments.userId", "username profilePic");

    res.json(note.comments[note.comments.length - 1]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Delete Note ───────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found." });
    if (note.userId.toString() !== req.session.userId.toString())
      return res.status(403).json({ error: "Unauthorized." });
    await note.deleteOne();
    res.json({ message: "Note deleted." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
