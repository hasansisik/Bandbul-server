const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // For group conversations in the future
    type: {
      type: String,
      enum: ['direct', 'group'],
      default: 'direct'
    },
    name: {
      type: String,
      trim: true
    },
    // Reference to the listing this conversation is about
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing'
    }
  },
  { timestamps: true }
);

// Ensure only 2 participants for direct messages and sort participants
ConversationSchema.pre('save', function(next) {
  if (this.type === 'direct' && this.participants.length !== 2) {
    return next(new Error('Direct conversations must have exactly 2 participants'));
  }
  
  // Sort participants to ensure consistent order for uniqueness
  if (this.type === 'direct') {
    this.participants.sort((a, b) => a.toString().localeCompare(b.toString()));
  }
  
  next();
});

// Index for better query performance
ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ 'participants': 1, 'lastMessageAt': -1 });

// For direct conversations, we'll handle uniqueness in the application logic
// since MongoDB array unique indexes don't work well with our use case

const Conversation = mongoose.model("Conversation", ConversationSchema);

module.exports = Conversation;
