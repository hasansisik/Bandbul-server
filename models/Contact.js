const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, "Ad soyad gereklidir"], 
      trim: true,
      maxlength: [100, "Ad soyad 100 karakterden uzun olamaz"]
    },
    email: { 
      type: String, 
      required: [true, "E-posta gereklidir"], 
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Geçerli bir e-posta adresi giriniz']
    },
    phone: { 
      type: String, 
      trim: true,
      maxlength: [20, "Telefon numarası 20 karakterden uzun olamaz"]
    },
    subject: { 
      type: String, 
      required: [true, "Konu gereklidir"], 
      trim: true,
      maxlength: [200, "Konu 200 karakterden uzun olamaz"]
    },
    message: { 
      type: String, 
      required: [true, "Mesaj gereklidir"], 
      trim: true,
      maxlength: [2000, "Mesaj 2000 karakterden uzun olamaz"]
    },
    status: {
      type: String,
      enum: {
        values: ['new', 'read', 'replied', 'closed'],
        message: '{VALUE} geçerli bir durum değil'
      },
      default: 'new'
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'urgent'],
        message: '{VALUE} geçerli bir öncelik değil'
      },
      default: 'medium'
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [1000, "Admin notları 1000 karakterden uzun olamaz"]
    },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    repliedAt: {
      type: Date
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for replied by user info
ContactSchema.virtual('repliedByInfo', {
  ref: 'User',
  localField: 'repliedBy',
  foreignField: '_id',
  justOne: true,
  select: 'name surname'
});

// Index for better query performance
ContactSchema.index({ status: 1, priority: 1, createdAt: -1 });
ContactSchema.index({ email: 1 });
ContactSchema.index({ createdAt: -1 });

const Contact = mongoose.model("Contact", ContactSchema);

module.exports = Contact;
