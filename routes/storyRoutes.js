const express = require('express');
const router = express.Router();
const multer = require('multer');
const Story = require('../models/Story');
const User = require('../models/User');
const { uploadToS3, deleteFromS3 } = require('../config/s3');

// ─── Multer Memory Storage (files go to S3, not disk) ────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const okImage = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    const okVideo = /^video\/(mp4|quicktime|webm|ogg|x-matroska)$/.test(file.mimetype);
    if (okImage || okVideo) return cb(null, true);
    cb(new Error('Only image or video files are allowed for stories.'));
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB to allow short videos
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated.' });
  next();
}

// Accept either field name "storyImage" (legacy) or "media" (new)
const acceptMedia = upload.fields([
  { name: 'media', maxCount: 1 },
  { name: 'storyImage', maxCount: 1 },
]);

// ── Create Story (image OR video) ─────────────────────────────────────────────
router.post('/', requireAuth, acceptMedia, async (req, res) => {
  try {
    const file = (req.files?.media?.[0]) || (req.files?.storyImage?.[0]);
    if (!file) return res.status(400).json({ error: 'Image or video is required for story.' });

    const { caption } = req.body;
    const isVideo = file.mimetype.startsWith('video/');

    const { url: fileUrl } = await uploadToS3(file);

    const story = new Story({
      userId: req.session.userId,
      image: isVideo ? null : fileUrl,
      video: isVideo ? fileUrl : null,
      isVideo,
      caption: caption || ''
    });

    await story.save();
    await story.populate('userId', 'username profilePic');

    res.json({ message: 'Story created successfully!', story });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stories Feed (ALL active stories, Instagram-style) ────────────────────────
// Any logged-in user can see every other user's active (non-expired) stories.
router.get('/feed', requireAuth, async (req, res) => {
  try {
    const me = req.session.userId.toString();

    const stories = await Story.find({ expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .populate('userId', 'username profilePic')
      .lean();

    // Group by author
    const grouped = {};
    stories.forEach(story => {
      if (!story.userId) return;
      const uid = story.userId._id.toString();
      if (!grouped[uid]) {
        grouped[uid] = { user: story.userId, stories: [], hasUnseen: false, isMe: uid === me };
      }
      const seenByMe = (story.viewedBy || []).some(
        v => v.userId && v.userId.toString() === me
      );
      if (!seenByMe && uid !== me) grouped[uid].hasUnseen = true;
      grouped[uid].stories.push(story);
    });

    // Order: my own first, then users with unseen stories, then the rest
    const result = Object.values(grouped).sort((a, b) => {
      if (a.isMe && !b.isMe) return -1;
      if (!a.isMe && b.isMe) return 1;
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      return 0;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get a Single User's Active Stories ────────────────────────────────────────
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    const stories = await Story.find({
      userId: req.params.userId,
      expiresAt: { $gt: new Date() }
    })
      .sort({ createdAt: 1 })
      .populate('userId', 'username profilePic')
      .lean();

    const me = req.session.userId.toString();
    res.json(stories.map(s => ({
      ...s,
      likesCount: (s.likes || []).length,
      likedByMe: (s.likes || []).map(String).includes(me),
      viewCount: (s.viewedBy || []).length,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mark Story as Viewed ──────────────────────────────────────────────────────
router.post('/:storyId/view', requireAuth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found.' });

    const me = req.session.userId.toString();
    const already = story.viewedBy.some(v => v.userId && v.userId.toString() === me);
    if (!already && story.userId.toString() !== me) {
      story.viewedBy.push({ userId: req.session.userId, viewedAt: new Date() });
      story.viewCount = story.viewedBy.length;
      await story.save();
    }
    res.json({ message: 'Story viewed.', viewCount: story.viewedBy.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Like / Unlike a Story ─────────────────────────────────────────────────────
router.post('/:storyId/like', requireAuth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found.' });

    const me = req.session.userId.toString();
    const liked = story.likes.map(String).includes(me);
    if (liked) story.likes.pull(req.session.userId);
    else story.likes.push(req.session.userId);

    await story.save();
    res.json({ liked: !liked, likesCount: story.likes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Comment on a Story ────────────────────────────────────────────────────────
router.post('/:storyId/comment', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim())
      return res.status(400).json({ error: 'Comment text required.' });

    const story = await Story.findById(req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found.' });

    story.comments.push({ userId: req.session.userId, text: text.trim() });
    await story.save();
    await story.populate('comments.userId', 'username profilePic');

    res.json(story.comments[story.comments.length - 1]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete Story ──────────────────────────────────────────────────────────────
router.delete('/:storyId', requireAuth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found.' });

    if (story.userId.toString() !== req.session.userId.toString())
      return res.status(403).json({ error: 'Unauthorized.' });

    // Delete media from S3 (extract key from the stored URL)
    const mediaUrl = story.video || story.image;
    if (mediaUrl) {
      try {
        const key = mediaUrl.split(`/${process.env.BUCKET}/`)[1];
        if (key) await deleteFromS3(key);
      } catch (_) {}
    }

    await story.deleteOne();
    res.json({ message: 'Story deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Viewers of a Story (only owner) ───────────────────────────────────────
router.get('/:storyId/viewers', requireAuth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId)
      .populate('viewedBy.userId', 'username profilePic')
      .populate('comments.userId', 'username profilePic')
      .populate('userId', '_id');
    if (!story) return res.status(404).json({ error: 'Story not found.' });
    if (story.userId._id.toString() !== req.session.userId.toString())
      return res.status(403).json({ error: 'Only the story owner can see viewers.' });
    res.json({
      viewCount: story.viewedBy.length,
      viewers: story.viewedBy.map(v => ({ user: v.userId, viewedAt: v.viewedAt })),
      comments: story.comments,
      likesCount: (story.likes || []).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
