const Settings = require("../models/Settings");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");

// Get settings (public - no authentication required)
const getSettings = async (req, res, next) => {
  try {
    const settings = await Settings.findOne({ isActive: true })
      .populate('populatedCategories')
      .select('-__v');

    if (!settings) {
      // Return empty settings if none exist
      return res.status(StatusCodes.OK).json({
        success: true,
        settings: null
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      settings
    });
  } catch (error) {
    next(error);
  }
};

// Get settings for admin (admin only)
const getSettingsAdmin = async (req, res, next) => {
  try {
    const settings = await Settings.findOne({ isActive: true })
      .populate('populatedCategories')
      .select('-__v');

    if (!settings) {
      throw new CustomError.NotFoundError("Site ayarları bulunamadı");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      settings
    });
  } catch (error) {
    next(error);
  }
};

// Create new settings (admin only)
const createSettings = async (req, res, next) => {
  try {
    // Check if settings already exist
    const existingSettings = await Settings.findOne({ isActive: true });
    if (existingSettings) {
      throw new CustomError.BadRequestError("Site ayarları zaten mevcut. Güncelleme yapın.");
    }

    const settingsData = req.body;
    
    // Ensure logo structure is correct
    if (settingsData.logo) {
      settingsData.logo = {
        light: settingsData.logo.light || "",
        dark: settingsData.logo.dark || ""
      };
    }
    
    // Create new settings
    const settings = new Settings(settingsData);
    await settings.save();

    // Populate categories
    await settings.populate('populatedCategories');

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Site ayarları başarıyla oluşturuldu",
      settings
    });
  } catch (error) {
    next(error);
  }
};

// Update settings (admin only)
const updateSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const settings = await Settings.findById(id);

    if (!settings) {
      throw new CustomError.NotFoundError("Site ayarları bulunamadı");
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key === 'header' && updates[key].categories) {
        // Handle categories array specially
        settings.header.categories = updates[key].categories;
        // Update other header fields
        if (updates[key].mainMenu) {
          settings.header.mainMenu = updates[key].mainMenu;
        }
      } else if (key === 'logo') {
        // Handle logo update with new structure
        if (updates[key].light) {
          settings.logo.light = updates[key].light;
        }
        if (updates[key].dark) {
          settings.logo.dark = updates[key].dark;
        }
      } else if (key !== 'header') {
        // Update other fields
        settings[key] = updates[key];
      }
    });

    await settings.save();

    // Populate categories
    await settings.populate('populatedCategories');

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Site ayarları başarıyla güncellendi",
      settings
    });
  } catch (error) {
    next(error);
  }
};

// Delete settings (admin only)
const deleteSettings = async (req, res, next) => {
  try {
    const { id } = req.params;

    const settings = await Settings.findById(id);

    if (!settings) {
      throw new CustomError.NotFoundError("Site ayarları bulunamadı");
    }

    // Soft delete - set isActive to false
    settings.isActive = false;
    await settings.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Site ayarları başarıyla silindi"
    });
  } catch (error) {
    next(error);
  }
};

// Get settings statistics (admin only)
const getSettingsStats = async (req, res, next) => {
  try {
    const stats = await Settings.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } }
        }
      }
    ]);

    const monthlyStats = await Settings.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      stats: stats[0] || {
        total: 0,
        active: 0,
        inactive: 0
      },
      monthlyStats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  getSettingsAdmin,
  createSettings,
  updateSettings,
  deleteSettings,
  getSettingsStats
};
