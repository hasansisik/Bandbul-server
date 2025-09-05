const mongoose = require("mongoose");

const BlogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Blog başlığı gereklidir"],
      trim: true,
      maxlength: [200, "Başlık 200 karakterden uzun olamaz"]
    },
    excerpt: {
      type: String,
      maxlength: [500, "Özet 500 karakterden uzun olamaz"]
    },
    content: {
      type: String,
      required: [true, "Blog içeriği gereklidir"]
    },
    author: {
      type: String,
      required: [true, "Yazar adı gereklidir"],
      trim: true
    },
    publishedDate: {
      type: Date,
      default: Date.now
    },
    readTime: {
      type: String,
      default: "5 dk"
    },
    category: {
      type: String,
      required: [true, "Kategori gereklidir"],
      trim: true
    },
    tags: [{
      type: String,
      trim: true
    }],
    image: {
      type: String,
      default: "/blogexample.jpg"
    },
    featured: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: {
        values: ['published', 'draft', 'archived'],
        message: '{VALUE} geçerli bir durum değil'
      },
      default: 'published'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

// Index for better search performance
BlogSchema.index({ title: 'text', excerpt: 'text', content: 'text' });
BlogSchema.index({ category: 1 });
BlogSchema.index({ featured: 1 });
BlogSchema.index({ status: 1 });
BlogSchema.index({ publishedDate: -1 });

// Helper function to create slug from title
BlogSchema.methods.createSlug = function() {
  return this.title
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

const Blog = mongoose.model("Blog", BlogSchema);

module.exports = Blog;
