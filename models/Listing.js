const mongoose = require("mongoose");

const ListingSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: [true, "İlan başlığı gereklidir"], 
      trim: true,
      maxlength: [100, "İlan başlığı 100 karakterden uzun olamaz"]
    },
    description: { 
      type: String, 
      required: [true, "İlan açıklaması gereklidir"], 
      trim: true,
      maxlength: [2000, "İlan açıklaması 2000 karakterden uzun olamaz"]
    },
    category: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'ListingCategory',
      required: [true, "Kategori gereklidir"]
    },
    location: { 
      type: String, 
      required: [true, "Konum gereklidir"], 
      trim: true 
    },
    image: { 
      type: String, 
      default: "/blogexample.jpg" 
    },
    experience: { 
      type: String, 
      required: [true, "Deneyim seviyesi gereklidir"],
      enum: {
        values: ['Başlangıç', 'Orta', 'İleri', 'Profesyonel'],
        message: '{VALUE} geçerli bir deneyim seviyesi değil'
      }
    },
    instrument: { 
      type: String, 
      trim: true 
    },
    type: { 
      type: String, 
      trim: true 
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'expired'],
        message: '{VALUE} geçerli bir durum değil'
      },
      default: 'active'
    },
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: [true, "Kullanıcı ID gereklidir"] 
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for author info (name, surname, picture)
ListingSchema.virtual('authorInfo', {
  ref: 'User',
  localField: 'user',
  foreignField: '_id',
  justOne: true,
  select: 'name surname profile'
});

// Virtual for category info (name, active)
ListingSchema.virtual('categoryInfo', {
  ref: 'ListingCategory',
  localField: 'category',
  foreignField: '_id',
  justOne: true,
  select: 'name active'
});

// Index for better query performance
ListingSchema.index({ category: 1, location: 1, status: 1 });
ListingSchema.index({ user: 1 });
ListingSchema.index({ createdAt: -1 });

const Listing = mongoose.model("Listing", ListingSchema);

module.exports = Listing;
