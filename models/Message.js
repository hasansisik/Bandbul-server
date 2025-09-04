const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Mesaj 1000 karakterden uzun olamaz']
    },
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file'],
      default: 'text'
    }
  },
  { timestamps: true }
);

// Index for better query performance
MessageSchema.index({ conversation: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });

const Message = mongoose.model("Message", MessageSchema);

module.exports = Message;
