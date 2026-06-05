const express = require("express");
const router = express.Router();
const multer = require("multer");
const Post = require("../models/Post");
const { uploadToS3, deleteFromS3 } = require("../config/s3");

// ── Multer Memory Storage (files go to S3, not disk) ─────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB to allow short videos
  fileFilter: (req, file, cb) => {
    const okImage = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    const okVideo = /^video\/(mp4|quicktime|webm|ogg|x-matroska)$/.test(file.mimetype);
    if (okImage || okVideo) return cb(null, true);
    cb(new Error("Only image or video files are allowed."));
  },
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated." });
  next();
}

// ── Create Post (image OR video) ──────────────────────────────────────────────
// Accepts a single file in either field name "image" or "media".
router.post("/", requireAuth, upload.single("media"), async (req, res) => {
  try {
    const { caption, location } = req.body;
    if (!caption && !req.file)
      return res.status(400).json({ error: "Caption or media required." });

    const isVideo = req.file && req.file.mimetype.startsWith("video/");
    let fileUrl = null;
    if (req.file) {
      const { url } = await uploadToS3(req.file);
      fileUrl = url;
    }

    const post = new Post({
      userId: req.session.userId,
      caption: caption || "",
      image: !isVideo ? fileUrl : null,
      video: isVideo ? fileUrl : null,
      isVideo: !!isVideo,
      location: location || "",
    });
    await post.save();
    await post.populate("userId", "username profilePic");
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backwards-compat alias: old clients posting field name "image"
router.post("/legacy", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const { caption } = req.body;
    if (!caption && !req.file)
      return res.status(400).json({ error: "Caption or image required." });
    let imageUrl = null;
    if (req.file) {
      const { url } = await uploadToS3(req.file);
      imageUrl = url;
    }
    const post = new Post({
      userId: req.session.userId,
      caption: caption || "",
      image: imageUrl,
    });
    await post.save();
    await post.populate("userId", "username profilePic");
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Reels Feed (videos only) ─────────────────────────────────────────────────
router.get("/reels", requireAuth, async (req, res) => {
  try {
    const posts = await Post.find({ isVideo: true })
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic")
      .lean();
    const userId = req.session.userId.toString();
    res.json(posts.map((p) => ({
      ...p,
      likedByMe: p.likes.map(String).includes(userId),
      likesCount: p.likes.length,
      commentsCount: (p.comments || []).length,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get All Posts (Feed) ──────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic")
      .lean();

    const userId = req.session.userId.toString();
    res.json(posts.map((p) => ({
      ...p,
      likedByMe: p.likes.map(String).includes(userId),
      dislikedByMe: p.dislikes.map(String).includes(userId),
      likesCount: p.likes.length,
      dislikesCount: p.dislikes.length,
      commentsCount: (p.comments || []).length,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Like Post ─────────────────────────────────────────────────────────────────
router.post("/:id/like", requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    const uid = req.session.userId;
    const liked = post.likes.map(String).includes(uid.toString());
    if (liked) post.likes.pull(uid);
    else { post.likes.push(uid); post.dislikes.pull(uid); }
    await post.save();
    res.json({ liked: !liked, likesCount: post.likes.length, dislikesCount: post.dislikes.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Dislike Post ──────────────────────────────────────────────────────────────
router.post("/:id/dislike", requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    const uid = req.session.userId;
    const disliked = post.dislikes.map(String).includes(uid.toString());
    if (disliked) post.dislikes.pull(uid);
    else { post.dislikes.push(uid); post.likes.pull(uid); }
    await post.save();
    res.json({ disliked: !disliked, likesCount: post.likes.length, dislikesCount: post.dislikes.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Delete Post ───────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    if (post.userId.toString() !== req.session.userId.toString())
      return res.status(403).json({ error: "Unauthorized." });

    // Delete media from S3 (extract key from the stored URL)
    for (const url of [post.image, post.video]) {
      if (!url) continue;
      try {
        const key = url.split(`/${process.env.BUCKET}/`)[1];
        if (key) await deleteFromS3(key);
      } catch (_) {}
    }
    await post.deleteOne();
    res.json({ message: "Post deleted." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Get Posts by User ─────────────────────────────────────────────────────────
router.get("/user/:userId", requireAuth, async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic")
      .lean();
    const me = req.session.userId.toString();
    res.json(posts.map((p) => ({
      ...p,
      likedByMe: (p.likes || []).map(String).includes(me),
      dislikedByMe: (p.dislikes || []).map(String).includes(me),
      likesCount: (p.likes || []).length,
      dislikesCount: (p.dislikes || []).length,
      commentsCount: (p.comments || []).length,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
