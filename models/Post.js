const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    caption: { type: String, default: "" },
    image: { type: String, default: null },

    // NEW: Video support
    video: { type: String, default: null },
    videoThumbnail: { type: String, default: null },
    isVideo: { type: Boolean, default: false },
    videoDuration: { type: Number, default: 0 }, // in seconds

    // NEW: Tagged users in post
    taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // NEW: Location
    location: { type: String, default: "" },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],

    // NEW: Save feature
    savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Post", postSchema);
