const { User, Auth, Profile, Address } = require("../models/User");
const Token = require("../models/Token");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");
const { sendResetPasswordEmail, sendVerificationEmail } = require("../helpers");
const { generateToken } = require("../services/token.service");
const { createWelcomeNotification } = require("./notification");
const bcrypt = require("bcrypt");
const Listing = require("../models/Listing");

//Register
const register = async (req, res, next) => {
  try {
    const {
      name,
      surname,
      email,
      password,
      courseTrial,
      picture,
      expoPushToken,
      age,
    } = req.body;

    //check email
    const emailAlreadyExists = await User.findOne({ email });
    if (emailAlreadyExists) {
      throw new CustomError.BadRequestError("Bu e-posta adresi zaten kayıtlı.");
    }

    //token create
    const verificationCode = Math.floor(1000 + Math.random() * 9000);

    // Create Auth document
    const auth = new Auth({
      password,
      verificationCode,
    });
    await auth.save();

    // Create Profile document
    const profile = new Profile({
      picture:
        picture || "https://res.cloudinary.com/da2qwsrbv/image/upload/v1757687384/sj3lcvvd7mjuuwpzann8.png",
    });
    await profile.save();

    // Create User with references
    const user = new User({
      name,
      surname,
      email,
      username: email.split("@")[0],
      courseTrial,
      expoPushToken,
      age,
      auth: auth._id,
      profile: profile._id,
      isVerified: false,
      status: 'inactive',
    });

    await user.save();

    // Update auth and profile with user reference
    auth.user = user._id;
    profile.user = user._id;
    await Promise.all([auth.save(), profile.save()]);

    const accessToken = await generateToken(
      { userId: user._id, role: user.role },
      "7d",
      process.env.ACCESS_TOKEN_SECRET
    );
    const refreshToken = await generateToken(
      { userId: user._id, role: user.role },
      "7d",
      process.env.REFRESH_TOKEN_SECRET
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/v1/auth/refreshtoken",
      maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });

    await sendVerificationEmail({
      name: user.name,
      email: user.email,
      verificationCode,
    });

    // Create welcome notification
    try {
      await createWelcomeNotification(user._id);
    } catch (notificationError) {
      console.error('Welcome notification creation failed:', notificationError);
      // Don't fail registration if notification creation fails
    }

    res.json({
      message:
        "Kullanıcı başarıyla oluşturuldu. Lütfen email adresini doğrula.",
      user: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        picture: profile.picture,
        courseTrial: user.courseTrial,
        theme: user.theme,
        token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

//Login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new CustomError.BadRequestError(
        "Lütfen e-posta adresinizi ve şifrenizi girin"
      );
    }

    const user = await User.findOne({ email })
      .populate({
        path: "auth",
        select: "+password",
      })
      .populate("profile");

    if (!user) {
      throw new CustomError.UnauthenticatedError(
        "Ne yazık ki böyle bir kullanıcı yok"
      );
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.auth.password
    );

    if (!isPasswordCorrect) {
      throw new CustomError.UnauthenticatedError("Kayıtlı şifreniz yanlış!");
    }
    if (!user.isVerified) {
      // Generate new verification code and send email
      const verificationCode = Math.floor(1000 + Math.random() * 9000);
      user.auth.verificationCode = verificationCode;
      await user.auth.save();

      await sendVerificationEmail({
        name: user.name,
        email: user.email,
        verificationCode: user.auth.verificationCode,
      });

      return res.status(403).json({
        message: "Lütfen e-postanızı doğrulayın !",
        requiresVerification: true,
        email: user.email,
      });
    }

    const accessToken = await generateToken(
      { userId: user._id, role: user.role },
      "7d",
      process.env.ACCESS_TOKEN_SECRET
    );
    const refreshToken = await generateToken(
      { userId: user._id, role: user.role },
      "7d",
      process.env.REFRESH_TOKEN_SECRET
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/v1/auth/refreshtoken",
      maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });

    const token = new Token({
      refreshToken,
      accessToken,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      user: user._id,
    });

    await token.save();

    res.json({
      message: "login success.",
      user: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        picture:
          user.profile?.picture ||
          "https://res.cloudinary.com/da2qwsrbv/image/upload/v1757687384/sj3lcvvd7mjuuwpzann8.png",
        status: user.status,
        courseTrial: user.courseTrial,
        theme: user.theme,
        token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

//Get My Profile
const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate("profile")
      .populate("address");

    if (!user) {
      return res.status(404).json({
        success: false,
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

//Get All Users (Admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const { 
      role, 
      status, 
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get users with pagination
    const users = await User.find(filter)
      .populate("profile")
      .populate("address")
      .select('-auth') // Don't send sensitive auth data
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await User.countDocuments(filter);

    // Get user statistics
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          admin: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          moderator: { $sum: { $cond: [{ $eq: ['$role', 'moderator'] }, 1, 0] } },
          user: { $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] } },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
          banned: { $sum: { $cond: [{ $eq: ['$status', 'banned'] }, 1, 0] } }
        }
      }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      users,
      stats: stats[0] || {
        total: 0,
        admin: 0,
        moderator: 0,
        user: 0,
        active: 0,
        inactive: 0,
        banned: 0
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

//Logout
const logout = async (req, res, next) => {
  try {
    await Token.findOneAndDelete({ user: req.user.userId });

    res.clearCookie("refreshtoken", { path: "/v1/auth/refreshtoken" });

    res.json({
      message: "logged out !",
    });
  } catch (error) {
    next(error);
  }
};

//Forgot Password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new CustomError.BadRequestError("Lütfen e-posta adresinizi girin.");
  }

  const user = await User.findOne({ email }).populate("auth");

  if (user) {
    const passwordToken = Math.floor(1000 + Math.random() * 9000);

    await sendResetPasswordEmail({
      name: user.name,
      email: user.email,
      passwordToken: passwordToken,
    });

    const tenMinutes = 1000 * 60 * 10;
    const passwordTokenExpirationDate = new Date(Date.now() + tenMinutes);

    user.auth.passwordToken = passwordToken;
    user.auth.passwordTokenExpirationDate = passwordTokenExpirationDate;

    await user.auth.save();
  } else {
    throw new CustomError.BadRequestError("Kullanıcı bulunamadı.");
  }

  res.status(StatusCodes.OK).json({
    message: "Şifre sıfırlama bağlantısı için lütfen e-postanızı kontrol edin.",
  });
};

//Reset Password
const resetPassword = async (req, res) => {
  try {
    const { email, passwordToken, newPassword } = req.body;
    if (!passwordToken || !newPassword) {
      throw new CustomError.BadRequestError(
        "Lütfen sıfırlama kodunu ve yeni şifrenizi girin."
      );
    }

    const user = await User.findOne({ email }).populate({
      path: "auth",
      select: "+passwordToken +passwordTokenExpirationDate",
    });

    if (user) {
      const currentDate = new Date();

      // Convert passwordToken to string for comparison
      if (user.auth.passwordToken === String(passwordToken)) {
        if (currentDate > user.auth.passwordTokenExpirationDate) {
          throw new CustomError.BadRequestError(
            "Kodunuz süresi doldu. Lütfen tekrar deneyin."
          );
        }
        user.auth.password = newPassword;
        user.auth.passwordToken = null;
        user.auth.passwordTokenExpirationDate = null;
        await user.auth.save();
        res.json({
          message: "Şifre başarıyla sıfırlandı.",
        });
      } else {
        res.status(400).json({
          message: "Geçersiz sıfırlama kodu.",
        });
      }
    } else {
      res.status(404).json({
        message: "Kullanıcı bulunamadı.",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Sistem hatası oluştu. Lütfen tekrar deneyin.",
    });
  }
};

//Edit Profile
const editProfile = async (req, res) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      "name",
      "surname",
      "email",
      "password",
      "address",
      "phoneNumber",
      "courseTrial",
      "picture",
      "birthDate",
      "age",
      "gender",
      "weight",
      "height",
      "bio",
      "skills",
      "theme",
    ];
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res
        .status(400)
        .send({ error: "Sistem hatası oluştu. Lütfen tekrar deneyin" });
    }

    const user = await User.findById(req.user.userId)
      .populate("auth")
      .populate("profile")
      .populate("address");

    if (!user) {
      return res.status(404).json({
        message: "Kullanıcı bulunamadı.",
      });
    }

    if (req.body.email && req.body.email !== user.email) {
      const verificationCode = Math.floor(1000 + Math.random() * 9000);
      user.email = req.body.email;
      user.auth.verificationCode = verificationCode;
      user.isVerified = false;

      await sendVerificationEmail({
        name: user.name,
        email: user.email,
        verificationCode: verificationCode,
      });
    }

    // Handle basic fields
    if (req.body.name) user.name = req.body.name;
    if (req.body.surname) user.surname = req.body.surname;
    if (req.body.courseTrial) user.courseTrial = req.body.courseTrial;
    if (req.body.theme) user.theme = req.body.theme;

    // Handle new profile fields
    if (req.body.birthDate) user.birthDate = new Date(req.body.birthDate);
    if (req.body.age) user.age = req.body.age;
    if (req.body.gender) user.gender = req.body.gender;
    if (req.body.weight) user.weight = req.body.weight;
    if (req.body.height) user.height = req.body.height;

    // Handle password
    if (req.body.password) {
      user.auth.password = req.body.password;
      await user.auth.save();
    }

    // Handle phone number
    if (req.body.phoneNumber) {
      if (!user.profile) {
        const profile = new Profile({
          phoneNumber: req.body.phoneNumber,
          user: user._id,
        });
        await profile.save();
        user.profile = profile._id;
      } else {
        user.profile.phoneNumber = req.body.phoneNumber;
        await user.profile.save();
      }
    }

    // Handle profile picture
    if (req.body.picture) {
      if (!user.profile) {
        const profile = new Profile({
          picture: req.body.picture,
          user: user._id,
        });
        await profile.save();
        user.profile = profile._id;
      } else {
        user.profile.picture = req.body.picture;
        await user.profile.save();
      }
    }

    // Handle bio
    if (req.body.bio !== undefined) {
      if (!user.profile) {
        const profile = new Profile({
          bio: req.body.bio,
          user: user._id,
        });
        await profile.save();
        user.profile = profile._id;
      } else {
        user.profile.bio = req.body.bio;
        await user.profile.save();
      }
    }

    // Handle skills
    if (req.body.skills !== undefined) {
      if (!user.profile) {
        const profile = new Profile({
          skills: req.body.skills,
          user: user._id,
        });
        await profile.save();
        user.profile = profile._id;
      } else {
        user.profile.skills = req.body.skills;
        await user.profile.save();
      }
    }

    // Handle address
    if (req.body.address) {
      // Check if address is an object with the expected fields
      const addressData = req.body.address;

      if (!user.address) {
        // Create new address
        const address = new Address({
          street: addressData.street || "",
          city: addressData.city || "", // This is actually the district (ilçe)
          state: addressData.state || "", // This is actually the province (il)
          postalCode: addressData.postalCode || "",
          country: addressData.country || "Turkey",
          user: user._id,
        });
        await address.save();
        user.address = address._id;
      } else {
        // Update existing address
        if (addressData.street !== undefined)
          user.address.street = addressData.street;
        if (addressData.city !== undefined)
          user.address.city = addressData.city; // District (ilçe)
        if (addressData.state !== undefined)
          user.address.state = addressData.state; // Province (il)
        if (addressData.postalCode !== undefined)
          user.address.postalCode = addressData.postalCode;
        if (addressData.country !== undefined)
          user.address.country = addressData.country;
        await user.address.save();
      }
    }

    await user.save();

    res.json({
      message: "Profil başarıyla güncellendi.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Sistem hatası oluştu. Lütfen tekrar deneyin",
    });
  }
};

//Verify Password
const verifyPassword = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Şifre gereklidir.",
      });
    }

    const user = await User.findById(req.user.userId).populate({
      path: "auth",
      select: "+password",
    });

    if (!user) {
      return res.status(404).json({
        message: "Kullanıcı bulunamadı.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.auth.password
    );

    if (!isPasswordCorrect) {
      return res.status(400).json({
        message: "Yanlış şifre.",
        isValid: false,
      });
    }

    res.json({
      message: "Şifre doğrulandı.",
      isValid: true,
    });
  } catch (error) {
    next(error);
  }
};

//Email
const verifyEmail = async (req, res) => {
  const { email, verificationCode } = req.body;
  const user = await User.findOne({ email }).populate("auth");

  if (!user) {
    return res.status(400).json({ message: "Kullanıcı bulunamadı." });
  }

  if (user.auth.verificationCode !== Number(verificationCode)) {
    return res.status(400).json({ message: "Doğrulama kodu yanlış." });
  }

  user.isVerified = true;
  user.status = 'active';
  user.auth.verificationCode = undefined;
  await user.save();
  await user.auth.save();

  res.json({ message: "Hesap başarıyla doğrulandı." });
};

//Again Email
const againEmail = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email }).populate("auth");

  if (!user) {
    throw new Error("Kullanıcı bulunamadı.");
  }

  const verificationCode = Math.floor(1000 + Math.random() * 9000);

  user.auth.verificationCode = verificationCode;
  await user.auth.save();

  await sendVerificationEmail({
    name: user.name,
    email: user.email,
    verificationCode: user.auth.verificationCode,
  });
  res.json({ message: "Doğrulama kodu Gönderildi" });
};

//Delete Account
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "Kullanıcı bulunamadı.",
      });
    }
        
    // Get count of user's listings before deletion
    const listingCount = await Listing.countDocuments({ user: userId });
    
    // Delete profile
    if (user.profile) {
      await Profile.findByIdAndDelete(user.profile);
    }
    // Delete auth
    if (user.auth) {
      await Auth.findByIdAndDelete(user.auth);
    }
    // Delete address
    if (user.address) {
      await Address.findByIdAndDelete(user.address);
    }
    // Delete tokens
    await Token.deleteMany({ user: userId });
    // Delete the user (this will trigger the pre-delete middleware to delete listings)
    await User.findByIdAndDelete(userId);
    
    res.status(200).json({
      message: `Hesabınız ve ${listingCount} ilanınız başarıyla silindi.`,
    });
  } catch (error) {
    next(error);
  }
};

//Google Auth (Unified Login/Register)
const googleAuth = async (req, res, next) => {
  try {
    const { email, name, surname, picture, googleId } = req.body;

    if (!email || !name || !googleId) {
      throw new CustomError.BadRequestError("Google bilgileri eksik");
    }

    let user = await User.findOne({ email })
      .populate("profile")
      .populate("auth");

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      
      const auth = new Auth({
        password: "google_oauth_user", // Dummy password for Google users
        verificationCode: undefined, // Google users don't need email verification
      });
      await auth.save();

      // Create Profile document
      const profile = new Profile({
        picture: "https://res.cloudinary.com/da2qwsrbv/image/upload/v1757687384/sj3lcvvd7mjuuwpzann8.png",
      });
      await profile.save();

      // Create User with references
      user = new User({
        name,
        surname: surname || 'User',
        email,
        username: email.split("@")[0],
        expoPushToken: null,
        auth: auth._id,
        profile: profile._id,
        isVerified: true, // Google users are automatically verified
        status: 'active', // Google users are automatically active
      });

      await user.save();

      // Update auth and profile with user reference
      auth.user = user._id;
      profile.user = user._id;
      await Promise.all([auth.save(), profile.save()]);

      // Create welcome notification for new users
      try {
        await createWelcomeNotification(user._id);
      } catch (notificationError) {
        console.error('Welcome notification creation failed:', notificationError);
        // Don't fail registration if notification creation fails
      }
    } else {
      // Update existing user if needed
      if (!user.isVerified) {
        user.isVerified = true;
        user.status = 'active';
        await user.save();
      }
    }

    // Generate tokens
    const accessToken = await generateToken(
      { userId: user._id, role: user.role },
      "7d",
      process.env.ACCESS_TOKEN_SECRET
    );
    const refreshToken = await generateToken(
      { userId: user._id, role: user.role },
      "7d",
      process.env.REFRESH_TOKEN_SECRET
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/v1/auth/refreshtoken",
      maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });

    const token = new Token({
      refreshToken,
      accessToken,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      user: user._id,
    });

    await token.save();

    res.json({
      message: isNewUser ? "Google ile kayıt başarılı." : "Google ile giriş başarılı.",
      user: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        picture: user.profile?.picture || picture || "https://res.cloudinary.com/da2qwsrbv/image/upload/v1757687384/sj3lcvvd7mjuuwpzann8.png",
        status: user.status,
        courseTrial: user.courseTrial,
        theme: user.theme,
        token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

//Google Login
const googleLogin = async (req, res, next) => {
  try {
    const { email, name, surname, picture, googleId } = req.body;

    if (!email || !name || !surname || !googleId) {
      throw new CustomError.BadRequestError("Google bilgileri eksik");
    }

    // Check if user exists
    let user = await User.findOne({ email })
      .populate("profile")
      .populate("auth");

    if (!user) {
      throw new CustomError.UnauthenticatedError("Kullanıcı bulunamadı. Lütfen önce kayıt olun.");
    }

    // Check if user is verified (Google users are automatically verified)
    if (!user.isVerified) {
      user.isVerified = true;
      user.status = 'active';
      await user.save();
    }

    // Generate tokens
    const accessToken = await generateToken(
      { userId: user._id, role: user.role },
      "7d",
      process.env.ACCESS_TOKEN_SECRET
    );
    const refreshToken = await generateToken(
      { userId: user._id, role: user.role },
      "7d",
      process.env.REFRESH_TOKEN_SECRET
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/v1/auth/refreshtoken",
      maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });

    const token = new Token({
      refreshToken,
      accessToken,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      user: user._id,
    });

    await token.save();

    res.json({
      message: "Google ile giriş başarılı.",
      user: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        picture: user.profile?.picture || picture || "https://res.cloudinary.com/da2qwsrbv/image/upload/v1757687384/sj3lcvvd7mjuuwpzann8.png",
        status: user.status,
        courseTrial: user.courseTrial,
        theme: user.theme,
        token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

//Google Register
const googleRegister = async (req, res, next) => {
  try {
    const { email, name, surname, picture, googleId } = req.body;

    if (!email || !name || !surname || !googleId) {
      throw new CustomError.BadRequestError("Google bilgileri eksik");
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new CustomError.BadRequestError("Bu e-posta adresi zaten kayıtlı.");
    }

    const auth = new Auth({
      password: "google_oauth_user", // Dummy password for Google users
      verificationCode: undefined, // Google users don't need email verification
    });
    await auth.save();

    // Create Profile document
    const profile = new Profile({
      picture: picture || "https://res.cloudinary.com/da2qwsrbv/image/upload/v1757687384/sj3lcvvd7mjuuwpzann8.png",
    });
    await profile.save();

    // Create User with references
    const user = new User({
      name,
      surname,
      email,
      username: email.split("@")[0],
      expoPushToken: null,
      auth: auth._id,
      profile: profile._id,
      isVerified: true, // Google users are automatically verified
      status: 'active', // Google users are automatically active
    });

    await user.save();

    // Update auth and profile with user reference
    auth.user = user._id;
    profile.user = user._id;
    await Promise.all([auth.save(), profile.save()]);

    const accessToken = await generateToken(
      { userId: user._id, role: user.role },
      "7d",
      process.env.ACCESS_TOKEN_SECRET
    );
    const refreshToken = await generateToken(
      { userId: user._id, role: user.role },
      "7d",
      process.env.REFRESH_TOKEN_SECRET
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/v1/auth/refreshtoken",
      maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });

    // Create welcome notification
    try {
      await createWelcomeNotification(user._id);
    } catch (notificationError) {
      console.error('Welcome notification creation failed:', notificationError);
      // Don't fail registration if notification creation fails
    }

    res.json({
      message: "Google ile kayıt başarılı.",
      user: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        picture: profile.picture,
        courseTrial: user.courseTrial,
        theme: user.theme,
        token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

//Delete User (Admin only)
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      throw new CustomError.NotFoundError("Kullanıcı bulunamadı");
    }

    // Check if admin is trying to delete themselves
    if (id === req.user.userId) {
      throw new CustomError.BadRequestError("Kendinizi silemezsiniz");
    }

    // Check if admin is trying to delete another admin
    if (user.role === 'admin') {
      throw new CustomError.UnauthorizedError("Admin kullanıcıları silemezsiniz");
    }

    // Get count of user's listings before deletion
    const listingCount = await Listing.countDocuments({ user: id });
    
    // Delete profile
    if (user.profile) {
      await Profile.findByIdAndDelete(user.profile);
    }
    // Delete auth
    if (user.auth) {
      await Auth.findByIdAndDelete(user.auth);
    }
    // Delete address
    if (user.address) {
      await Address.findByIdAndDelete(user.address);
    }
    // Delete tokens
    await Token.deleteMany({ user: id });
    
    // Delete the user (this will trigger the pre-delete middleware to delete listings)
    await User.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Kullanıcı ve ${listingCount} ilanı başarıyla silindi`
    });
  } catch (error) {
    next(error);
  }
};

//Update User Role (Admin only)
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    if (!role || !['admin', 'user'].includes(role)) {
      throw new CustomError.BadRequestError("Geçersiz rol. Sadece 'admin' veya 'user' rolleri kabul edilir");
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      throw new CustomError.NotFoundError("Kullanıcı bulunamadı");
    }

    // Check if admin is trying to change their own role
    if (id === req.user.userId) {
      throw new CustomError.BadRequestError("Kendi rolünüzü değiştiremezsiniz");
    }

    // Update user role
    user.role = role;
    await user.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Kullanıcı rolü başarıyla güncellendi",
      user: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

//Update User Status (Admin only)
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'inactive', 'banned'].includes(status)) {
      throw new CustomError.BadRequestError("Geçersiz durum. Sadece 'active', 'inactive' veya 'banned' durumları kabul edilir");
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      throw new CustomError.NotFoundError("Kullanıcı bulunamadı");
    }

    // Check if admin is trying to change their own status
    if (id === req.user.userId) {
      throw new CustomError.BadRequestError("Kendi durumunuzu değiştiremezsiniz");
    }

    // Update user status
    user.status = status;
    await user.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Kullanıcı durumu başarıyla güncellendi",
      user: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  googleRegister,
  googleAuth,
  login,
  googleLogin,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  getMyProfile,
  getAllUsers,
  againEmail,
  editProfile,
  verifyPassword,
  deleteAccount,
  deleteUser,
  updateUserRole,
  updateUserStatus,
};
