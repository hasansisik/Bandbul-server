const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Listing = require("./Listing");
const AddressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country: { type: String, trim: true, default: "Turkey" },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const Address = mongoose.model("Address", AddressSchema);

const AuthSchema = new mongoose.Schema({
  password: { type: String, required: true, select: false },
  verificationCode: { type: Number},
  passwordToken: { type: String, select: false },
  passwordTokenExpirationDate: { type: Date, select: false },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Şifreyi hashleme işlemi
AuthSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Şifre karşılaştırma metodu
AuthSchema.methods.comparePassword = async function (candidatePassword) {
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  return isMatch;
};

const Auth = mongoose.model("Auth", AuthSchema);

const ProfileSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    validate: {
      validator: function (v) {
        return /^(\+90|0)?5\d{9}$/.test(v);
      },
      message: (props) => `${props.value} is not a valid phone number!`,
    },
  },
  picture: {
    type: String,
    default: "https://res.cloudinary.com/da2qwsrbv/image/upload/v1757687384/sj3lcvvd7mjuuwpzann8.png",
  },
  bio: {
    type: String,
    maxlength: [500, 'Biyografi 500 karakterden uzun olamaz']
  },
  skills: [{
    type: String,
    trim: true
  }],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const Profile = mongoose.model("Profile", ProfileSchema);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    surname: { type: String, required: true, trim: true},
    username: { type: String, sparse: true},
    email: {
      type: String,
      required: [true, "Lütfen e-posta adresinizi girin"],
      unique: true,
      lowercase: true,
    },
    birthDate: { type: Date },
    age: { 
      type: Number,
      min: [13, 'Yaş 13\'ten az olamaz'],
      max: [120, 'Yaş 120\'den fazla olamaz']
    },
    gender: { 
      type: String, 
      enum: ['male', 'female', 'other'],
      lowercase: true 
    },
    weight: { 
      type: Number,
      min: [20, 'Kilo 20 kg\'dan az olamaz'],
      max: [300, 'Kilo 300 kg\'dan fazla olamaz']
    },
    height: { 
      type: Number,
      min: [100, 'Boy 100 cm\'den az olamaz'],
      max: [250, 'Boy 250 cm\'den fazla olamaz']
    },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    isVerified: { type: Boolean, default: false },
    address: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
    auth: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' }, 
    profile: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
    listings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
    conversations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' }],
    expoPushToken: { type: String },
    courseTrial: { type: String },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: '{VALUE} geçerli bir durum değil'
      },
      default: 'active'
    },
    theme: {
      type: String,
      enum: {
        values: ['light', 'dark'],
        message: '{VALUE} geçerli bir tema değil'
      },
      default: 'light'
    }
  },
  { timestamps: true }
);

// Pre-delete middleware to clean up associated data
UserSchema.pre('findOneAndDelete', async function(next) {
  const userId = this.getQuery()._id;
  
  try {
    // Import Listing model here to avoid circular dependency
    const Listing = require('./Listing');
    
    // Delete all listings associated with this user
    await Listing.deleteMany({ user: userId });
    
    console.log(`Deleted all listings for user: ${userId}`);
    next();
  } catch (error) {
    console.error('Error deleting user listings:', error);
    next(error);
  }
});

// Pre-delete middleware for findByIdAndDelete
UserSchema.pre('deleteOne', async function(next) {
  const userId = this.getQuery()._id;
  
  try {
    
    // Delete all listings associated with this user
    await Listing.deleteMany({ user: userId });
    
    console.log(`Deleted all listings for user: ${userId}`);
    next();
  } catch (error) {
    console.error('Error deleting user listings:', error);
    next(error);
  }
});

const User = mongoose.model("User", UserSchema);

module.exports = { User, Address, Auth, Profile };
