const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Image OR video path (one of them set)
    image: { type: String, default: null },
    video: { type: String, default: null },
    isVideo: { type: Boolean, default: false },

    caption: { type: String, default: "" },

    // Mentions
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Story viewers with timestamp
    viewedBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    viewCount: { type: Number, default: 0 },

    // Likes on stories
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Comments on stories (visible to story owner)
    comments: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Replies (legacy, kept for back-compat)
    allowReplies: { type: Boolean, default: true },
    replies: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Auto-expire after 24 hours
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Story", storySchema);
