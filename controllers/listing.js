const Listing = require("../models/Listing");
const { User } = require("../models/User");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");
const { createListingCreatedNotification } = require("./notification");
const mongoose = require("mongoose");

// Create new listing
const createListing = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      location,
      image,
      experience,
      instrument,
      type
    } = req.body;

    const userId = req.user.userId;
    const userRole = req.user.role;

    // Determine initial status based on user role
    let initialStatus = 'pending'; // Default for regular users
    if (userRole === 'admin') {
      initialStatus = 'active'; // Admin listings are automatically approved
    }

    // Create the listing
    const listing = new Listing({
      title,
      description,
      category,
      location,
      image: image || "/blogexample.jpg",
      experience,
      instrument,
      type: type || category,
      user: userId,
      status: initialStatus
    });

    // If admin, set approval info
    if (userRole === 'admin') {
      listing.approvedBy = userId;
      listing.approvedAt = new Date();
    }

    await listing.save();

    // Add listing to user's listings array
    await User.findByIdAndUpdate(
      userId,
      { $push: { listings: listing._id } }
    );

    // Populate author info, category info and instrument info
    await listing.populate('authorInfo');
    await listing.populate('categoryInfo');
    await listing.populate('instrumentInfo');
    await listing.populate('instrumentInfo');

    // Create listing created notification
    try {
      await createListingCreatedNotification(userId, listing._id, listing.title);
    } catch (notificationError) {
      console.error('Listing created notification failed:', notificationError);
      // Don't fail listing creation if notification creation fails
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "İlan başarıyla oluşturuldu",
      listing
    });
  } catch (error) {
    next(error);
  }
};

// Get all listings (public - no authentication required)
const getAllListings = async (req, res, next) => {
  try {
    const { 
      category, 
      location, 
      instrument, 
      experience, 
      search,
      status,
      page = 1,
      limit = 20
    } = req.query;

    // Build filter object
    const filter = {};
    
    // If status is specified, filter by status, otherwise show active listings for public access
    if (status) {
      if (status === 'all') {
        // Don't add status filter to show all listings
      } else {
        filter.status = status;
      }
    } else {
      // Default to active for public access
      filter.status = 'active';
    }
    
    if (category) {
      // Check if category is ObjectId or name
      if (mongoose.Types.ObjectId.isValid(category)) {
        filter.category = category;
      } else {
        // If it's a name, find the category first
        const ListingCategory = require("../models/ListingCategory");
        const categoryDoc = await ListingCategory.findOne({ name: category });
        if (categoryDoc) {
          filter.category = categoryDoc._id;
        }
      }
    }
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (instrument) filter.instrument = { $regex: instrument, $options: 'i' };
    if (experience) filter.experience = experience;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get listings with pagination
    const listings = await Listing.find(filter)
      .populate({
        path: 'authorInfo',
        populate: {
          path: 'profile',
          select: 'picture'
        }
      })
      .populate('categoryInfo')
      .populate('instrumentInfo')
      .populate('user', 'name surname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Listing.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      listings,
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

// Get single listing by ID (public)
const getListingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const listing = await Listing.findById(id)
      .populate({
        path: 'authorInfo',
        populate: {
          path: 'profile',
          select: 'picture'
        }
      })
      .populate('categoryInfo')
      .populate('instrumentInfo')
      .populate('user', 'name surname');

    if (!listing) {
      throw new CustomError.NotFoundError("İlan bulunamadı");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      listing
    });
  } catch (error) {
    next(error);
  }
};

// Get user's own listings
const getUserListings = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const listings = await Listing.find({ user: userId })
      .populate({
        path: 'authorInfo',
        populate: {
          path: 'profile',
          select: 'picture'
        }
      })
      .populate('categoryInfo')
      .populate('instrumentInfo')
      .populate('user', 'name surname')
      .sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({
      success: true,
      listings
    });
  } catch (error) {
    next(error);
  }
};

// Update listing (owner or admin can update)
const updateListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const listing = await Listing.findById(id);

    if (!listing) {
      throw new CustomError.NotFoundError("İlan bulunamadı");
    }

    // Check if user owns the listing or is admin
    if (listing.user.toString() !== userId && userRole !== 'admin') {
      throw new CustomError.UnauthorizedError("Bu işlem için yetkiniz yok");
    }

    const updates = Object.keys(req.body);
    const allowedUpdates = [
      'title', 'description', 'category', 'location', 
      'image', 'experience', 'instrument', 'type', 'status'
    ];

    const isValidOperation = updates.every(update => 
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      throw new CustomError.BadRequestError("Geçersiz güncelleme alanları");
    }

    // Update fields
    updates.forEach(update => {
      listing[update] = req.body[update];
    });

    // If category is updated, also update type if not explicitly provided
    if (req.body.category && !req.body.type) {
      listing.type = req.body.category;
    }

    // If any field is updated and listing was active, set status to pending for re-approval
    if (listing.status === 'active' && updates.length > 0) {
      listing.status = 'pending';
      // Clear previous approval info
      listing.approvedBy = undefined;
      listing.approvedAt = undefined;
    }

    await listing.save();

    // Populate author info and category info
    await listing.populate('authorInfo');
    await listing.populate('categoryInfo');
    await listing.populate('instrumentInfo');

    res.status(StatusCodes.OK).json({
      success: true,
      message: "İlan başarıyla güncellendi",
      listing
    });
  } catch (error) {
    next(error);
  }
};

// Delete listing (owner or admin can delete)
const deleteListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const listing = await Listing.findById(id);

    if (!listing) {
      throw new CustomError.NotFoundError("İlan bulunamadı");
    }

    // Check if user owns the listing or is admin
    if (listing.user.toString() !== userId && userRole !== 'admin') {
      throw new CustomError.UnauthorizedError("Bu işlem için yetkiniz yok");
    }

    // Remove listing from the original owner's listings array
    await User.findByIdAndUpdate(
      listing.user,
      { $pull: { listings: listing._id } }
    );

    // Delete the listing
    await Listing.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "İlan başarıyla silindi"
    });
  } catch (error) {
    console.error("Delete listing error:", error);
    next(error);
  }
};

// Toggle listing status (active/inactive/archived)
const toggleListingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const listing = await Listing.findById(id);

    if (!listing) {
      throw new CustomError.NotFoundError("İlan bulunamadı");
    }

    // Check if user owns the listing or is admin
    if (listing.user.toString() !== userId && userRole !== 'admin') {
      throw new CustomError.UnauthorizedError("Bu işlem için yetkiniz yok");
    }

    // Toggle status between active, inactive, and archived
    if (listing.status === 'active') {
      listing.status = 'archived';
    } else if (listing.status === 'archived') {
      listing.status = 'active';
    } else if (listing.status === 'inactive') {
      listing.status = 'active';
    } else {
      listing.status = 'archived';
    }
    
    await listing.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `İlan durumu ${listing.status === 'active' ? 'aktif' : listing.status === 'archived' ? 'arsivlendi' : 'pasif'} olarak güncellendi`,
      listing
    });
  } catch (error) {
    next(error);
  }
};

// Admin approve listing
const approveListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    const listing = await Listing.findById(id);

    if (!listing) {
      throw new CustomError.NotFoundError("İlan bulunamadı");
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
      throw new CustomError.UnauthorizedError("Bu işlem için admin yetkisi gereklidir");
    }

    listing.status = 'active';
    listing.approvedBy = adminId;
    listing.approvedAt = new Date();
    listing.rejectionReason = undefined; // Clear any previous rejection reason

    await listing.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "İlan başarıyla onaylandı",
      listing
    });
  } catch (error) {
    next(error);
  }
};

// Admin reject listing
const rejectListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.userId;

    const listing = await Listing.findById(id);

    if (!listing) {
      throw new CustomError.NotFoundError("İlan bulunamadı");
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
      throw new CustomError.UnauthorizedError("Bu işlem için admin yetkisi gereklidir");
    }

    listing.status = 'rejected';
    listing.rejectionReason = reason || 'Belirtilmemiş neden';
    listing.approvedBy = undefined;
    listing.approvedAt = undefined;

    await listing.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "İlan reddedildi",
      listing
    });
  } catch (error) {
    next(error);
  }
};

// Get pending listings for admin
const getPendingListings = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      throw new CustomError.UnauthorizedError("Bu işlem için admin yetkisi gereklidir");
    }

    const listings = await Listing.find({ status: 'pending' })
      .populate({
        path: 'authorInfo',
        populate: {
          path: 'profile',
          select: 'picture'
        }
      })
      .populate('categoryInfo')
      .populate('instrumentInfo')
      .populate('user', 'name surname')
      .sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({
      success: true,
      listings
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createListing,
  getAllListings,
  getListingById,
  getUserListings,
  updateListing,
  deleteListing,
  toggleListingStatus,
  approveListing,
  rejectListing,
  getPendingListings
};
