const Listing = require("../models/Listing");
const { User } = require("../models/User");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");
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
      user: userId
    });

    await listing.save();

    // Add listing to user's listings array
    await User.findByIdAndUpdate(
      userId,
      { $push: { listings: listing._id } }
    );

    // Populate author info and category info
    await listing.populate('authorInfo');
    await listing.populate('categoryInfo');

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "İlan başarıyla oluşturuldu",
      listing
    });
  } catch (error) {
    console.log(error)
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
      page = 1,
      limit = 20
    } = req.query;

    // Build filter object
    const filter = { status: 'active' };
    
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
      .populate('authorInfo')
      .populate('categoryInfo')
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
      .populate('authorInfo')
      .populate('categoryInfo');

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
      .populate('authorInfo')
      .populate('categoryInfo')
      .sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({
      success: true,
      listings
    });
  } catch (error) {
    next(error);
  }
};

// Update listing (only owner can update)
const updateListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const listing = await Listing.findById(id);

    if (!listing) {
      throw new CustomError.NotFoundError("İlan bulunamadı");
    }

    // Check if user owns the listing
    if (listing.user.toString() !== userId) {
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

    await listing.save();

    // Populate author info and category info
    await listing.populate('authorInfo');
    await listing.populate('categoryInfo');

    res.status(StatusCodes.OK).json({
      success: true,
      message: "İlan başarıyla güncellendi",
      listing
    });
  } catch (error) {
    next(error);
  }
};

// Delete listing (only owner can delete)
const deleteListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const listing = await Listing.findById(id);

    if (!listing) {
      throw new CustomError.NotFoundError("İlan bulunamadı");
    }

    // Check if user owns the listing
    if (listing.user.toString() !== userId) {
      throw new CustomError.UnauthorizedError("Bu işlem için yetkiniz yok");
    }

    // Remove listing from user's listings array
    await User.findByIdAndUpdate(
      userId,
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

// Toggle listing status (active/inactive)
const toggleListingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const listing = await Listing.findById(id);

    if (!listing) {
      throw new CustomError.NotFoundError("İlan bulunamadı");
    }

    // Check if user owns the listing
    if (listing.user.toString() !== userId) {
      throw new CustomError.UnauthorizedError("Bu işlem için yetkiniz yok");
    }

    // Toggle status between active and inactive
    listing.status = listing.status === 'active' ? 'inactive' : 'active';
    await listing.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `İlan durumu ${listing.status === 'active' ? 'aktif' : 'pasif'} olarak güncellendi`,
      listing
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
  toggleListingStatus
};
