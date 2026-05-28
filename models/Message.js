const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messageText: { type: String, default: '', trim: true },

  // Optional attachment (image / video / generic file)
  attachment: {
    url:      { type: String, default: null },
    mimeType: { type: String, default: null },
    fileName: { type: String, default: null },
    kind:     { type: String, enum: ['image', 'video', 'file', null], default: null },
    size:     { type: Number, default: 0 },
  },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
