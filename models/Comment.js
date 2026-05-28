const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  commentText: { type: String, required: true, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
