const mongoose = require("mongoose");

const InstrumentSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, "Enstrüman adı gereklidir"], 
      trim: true,
      maxlength: [50, "Enstrüman adı 50 karakterden uzun olamaz"]
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
InstrumentSchema.index({ name: 1 });
InstrumentSchema.index({ active: 1 });

const Instrument = mongoose.model("Instrument", InstrumentSchema);

module.exports = Instrument;
