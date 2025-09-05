const mongoose = require("mongoose");

const ListingCategorySchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, "Kategori adı gereklidir"], 
      trim: true,
      maxlength: [50, "Kategori adı 50 karakterden uzun olamaz"]
    },
    active: { 
      type: Boolean, 
      default: true 
    }
  },
  { 
    timestamps: true 
  }
);


// Index for better query performance
ListingCategorySchema.index({ name: 1 });
ListingCategorySchema.index({ active: 1 });

const ListingCategory = mongoose.model("ListingCategory", ListingCategorySchema);

module.exports = ListingCategory;
