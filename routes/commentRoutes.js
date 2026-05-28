const express = require('express');
const router  = express.Router();
const Comment = require('../models/Comment');
const Post = require('../models/Post');

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated.' });
  next();
}

// ── Add Comment ───────────────────────────────────────────────────────────────
router.post('/:postId', requireAuth, async (req, res) => {
  try {
    const { commentText } = req.body;
    if (!commentText || !commentText.trim())
      return res.status(400).json({ error: 'Comment cannot be empty.' });

    const comment = new Comment({
      postId:      req.params.postId,
      userId:      req.session.userId,
      commentText: commentText.trim(),
    });
    await comment.save();
    await Post.findByIdAndUpdate(req.params.postId, { $addToSet: { comments: comment._id } });
    await comment.populate('userId', 'username profilePic');
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Comments for Post ─────────────────────────────────────────────────────
router.get('/:postId', requireAuth, async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId })
      .sort({ createdAt: 1 })
      .populate('userId', 'username profilePic');
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete Comment ────────────────────────────────────────────────────────────
router.delete('/:commentId', requireAuth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });
    if (comment.userId.toString() !== req.session.userId.toString())
      return res.status(403).json({ error: 'Unauthorized.' });
    await Post.findByIdAndUpdate(comment.postId, { $pull: { comments: comment._id } });
    await comment.deleteOne();
    res.json({ message: 'Comment deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
