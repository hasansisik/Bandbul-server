const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema(
  {
    logo: {
      light: {
        type: String,
        default: ""
      },
      dark: {
        type: String,
        default: ""
      }
    },
    metadata: {
      title: {
        type: String,
        required: [true, "Site başlığı gereklidir"],
        trim: true,
        maxlength: [100, "Site başlığı 100 karakterden uzun olamaz"]
      },
      description: {
        type: String,
        required: [true, "Site açıklaması gereklidir"],
        trim: true,
        maxlength: [500, "Site açıklaması 500 karakterden uzun olamaz"]
      },
      keywords: {
        type: String,
        trim: true,
        maxlength: [300, "Anahtar kelimeler 300 karakterden uzun olamaz"]
      },
      author: {
        type: String,
        trim: true,
        maxlength: [100, "Yazar adı 100 karakterden uzun olamaz"]
      }
    },
    header: {
      mainMenu: [{
        name: {
          type: String,
          required: [true, "Menü adı gereklidir"],
          trim: true,
          maxlength: [50, "Menü adı 50 karakterden uzun olamaz"]
        },
        href: {
          type: String,
          required: [true, "Menü linki gereklidir"],
          trim: true,
          maxlength: [200, "Menü linki 200 karakterden uzun olamaz"]
        }
      }],
      categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ListingCategory'
      }]
    },
    footer: {
      main: [{
        name: {
          type: String,
          required: [true, "Footer link adı gereklidir"],
          trim: true,
          maxlength: [50, "Footer link adı 50 karakterden uzun olamaz"]
        },
        href: {
          type: String,
          required: [true, "Footer link adresi gereklidir"],
          trim: true,
          maxlength: [200, "Footer link adresi 200 karakterden uzun olamaz"]
        }
      }],
      listings: [{
        name: {
          type: String,
          required: [true, "İlan link adı gereklidir"],
          trim: true,
          maxlength: [50, "İlan link adı 50 karakterden uzun olamaz"]
        },
        href: {
          type: String,
          required: [true, "İlan link adresi gereklidir"],
          trim: true,
          maxlength: [200, "İlan link adresi 200 karakterden uzun olamaz"]
        }
      }],
      support: [{
        name: {
          type: String,
          required: [true, "Destek link adı gereklidir"],
          trim: true,
          maxlength: [50, "Destek link adı 50 karakterden uzun olamaz"]
        },
        href: {
          type: String,
          required: [true, "Destek link adresi gereklidir"],
          trim: true,
          maxlength: [200, "Destek link adresi 200 karakterden uzun olamaz"]
        }
      }],
      social: {
        facebook: {
          type: String,
          trim: true,
          maxlength: [200, "Facebook URL 200 karakterden uzun olamaz"]
        },
        twitter: {
          type: String,
          trim: true,
          maxlength: [200, "Twitter URL 200 karakterden uzun olamaz"]
        },
        instagram: {
          type: String,
          trim: true,
          maxlength: [200, "Instagram URL 200 karakterden uzun olamaz"]
        },
        youtube: {
          type: String,
          trim: true,
          maxlength: [200, "YouTube URL 200 karakterden uzun olamaz"]
        }
      }
    },
    contact: {
      email: {
        type: String,
        required: [true, "E-posta adresi gereklidir"],
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Geçerli bir e-posta adresi giriniz']
      },
      phone: {
        type: String,
        trim: true,
        maxlength: [20, "Telefon numarası 20 karakterden uzun olamaz"]
      },
      address: {
        type: String,
        trim: true,
        maxlength: [200, "Adres 200 karakterden uzun olamaz"]
      },
      workingHours: {
        type: String,
        trim: true,
        maxlength: [100, "Çalışma saatleri 100 karakterden uzun olamaz"]
      },
      companyDescription: {
        type: String,
        trim: true,
        maxlength: [1000, "Şirket açıklaması 1000 karakterden uzun olamaz"]
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    seo: {
      googleAnalytics: {
        type: String,
        trim: true,
        maxlength: [100, "Google Analytics ID 100 karakterden uzun olamaz"]
      },
      googleTagManager: {
        type: String,
        trim: true,
        maxlength: [100, "Google Tag Manager ID 100 karakterden uzun olamaz"]
      },
      metaTags: {
        type: String,
        trim: true,
        maxlength: [1000, "Meta etiketleri 1000 karakterden uzun olamaz"]
      }
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for populated categories
SettingsSchema.virtual('populatedCategories', {
  ref: 'ListingCategory',
  localField: 'header.categories',
  foreignField: '_id',
  justOne: false
});

// Index for better query performance
SettingsSchema.index({ isActive: 1 });
SettingsSchema.index({ 'metadata.title': 1 });

const Settings = mongoose.model("Settings", SettingsSchema);

module.exports = Settings;
