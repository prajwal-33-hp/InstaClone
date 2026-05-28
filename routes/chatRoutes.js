const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const Message = require('../models/Message');

// ─── Multer Configuration (chat attachments) ──────────────────────────────────
const uploadDir = path.join(__dirname, '../public/images/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `chat_${req.session.userId}_${Date.now()}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated.' });
  next();
}

function classifyKind(mime) {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

// ── Send Message (text and/or file attachment) ────────────────────────────────
router.post('/send', requireAuth, upload.single('attachment'), async (req, res) => {
  try {
    const { receiverId } = req.body;
    const messageText = (req.body.messageText || '').trim();

    if (!receiverId)
      return res.status(400).json({ error: 'Receiver is required.' });

    if (!messageText && !req.file)
      return res.status(400).json({ error: 'Message text or attachment required.' });

    const doc = {
      senderId:    req.session.userId,
      receiverId,
      messageText,
    };

    if (req.file) {
      doc.attachment = {
        url:      `/images/uploads/${req.file.filename}`,
        mimeType: req.file.mimetype,
        fileName: req.file.originalname,
        kind:     classifyKind(req.file.mimetype),
        size:     req.file.size,
      };
    }

    const message = new Message(doc);
    await message.save();
    await message.populate('senderId', 'username profilePic');
    res.json(message);
  } catch (err) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
    res.status(500).json({ error: err.message });
  }
});

// ── Get Conversation ──────────────────────────────────────────────────────────
router.get('/conversation/:otherId', requireAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const other = req.params.otherId;
    const messages = await Message.find({
      $or: [
        { senderId: me, receiverId: other },
        { senderId: other, receiverId: me }
      ]
    })
      .sort({ createdAt: 1 })
      .populate('senderId', 'username profilePic');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
