const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, "Kullanıcı gereklidir"]
    },
    type: {
      type: String,
      enum: {
        values: ['welcome', 'listing_created', 'listing_approved', 'listing_rejected', 'message_received', 'system'],
        message: '{VALUE} geçerli bir bildirim türü değil'
      },
      required: [true, "Bildirim türü gereklidir"]
    },
    title: {
      type: String,
      required: [true, "Başlık gereklidir"],
      trim: true,
      maxlength: [200, "Başlık 200 karakterden uzun olamaz"]
    },
    message: {
      type: String,
      required: [true, "Mesaj gereklidir"],
      trim: true,
      maxlength: [1000, "Mesaj 1000 karakterden uzun olamaz"]
    },
    isRead: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // İlan bildirimleri için
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing'
    },
    // Mesaj bildirimleri için
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    // Sistem bildirimleri için
    systemAction: {
      type: String,
      enum: ['welcome', 'listing_created', 'listing_approved', 'listing_rejected', 'message_received']
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for user info
NotificationSchema.virtual('userInfo', {
  ref: 'User',
  localField: 'user',
  foreignField: '_id',
  justOne: true,
  select: 'name surname picture'
});

// Virtual for listing info
NotificationSchema.virtual('listingInfo', {
  ref: 'Listing',
  localField: 'listingId',
  foreignField: '_id',
  justOne: true,
  select: 'title image category'
});

// Index for better query performance
NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, isDeleted: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model("Notification", NotificationSchema);

module.exports = Notification;
