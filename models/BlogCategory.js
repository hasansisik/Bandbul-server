const mongoose = require("mongoose");

const BlogCategorySchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, "Kategori adı gereklidir"], 
      trim: true,
      unique: true,
      maxlength: [50, "Kategori adı 50 karakterden uzun olamaz"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Açıklama 200 karakterden uzun olamaz"]
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
BlogCategorySchema.index({ name: 1 });
BlogCategorySchema.index({ active: 1 });

const BlogCategory = mongoose.model("BlogCategory", BlogCategorySchema);

module.exports = BlogCategory;
