const Instrument = require("../models/Instrument");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");


// Create new instrument (admin only)
const createInstrument = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      throw new CustomError.BadRequestError("Enstrüman adı gereklidir");
    }

    // Check if instrument already exists
    const existingInstrument = await Instrument.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingInstrument) {
      throw new CustomError.BadRequestError("Bu enstrüman adı zaten mevcut");
    }

    const instrument = new Instrument({
      name: name.trim()
    });

    await instrument.save();

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Enstrüman başarıyla oluşturuldu",
      instrument
    });
  } catch (error) {
    next(error);
  }
};

// Get all instruments (public)
const getAllInstruments = async (req, res, next) => {
  try {
    const { active } = req.query;
    
    let filter = {};
    if (active !== undefined) {
      filter.active = active === 'true';
    }

    const instruments = await Instrument.find(filter)
      .sort({ name: 1 });

    res.status(StatusCodes.OK).json({
      success: true,
      instruments
    });
  } catch (error) {
    next(error);
  }
};

// Get single instrument by ID (public)
const getInstrumentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const instrument = await Instrument.findById(id);

    if (!instrument) {
      throw new CustomError.NotFoundError("Enstrüman bulunamadı");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      instrument
    });
  } catch (error) {
    next(error);
  }
};

// Update instrument (admin only)
const updateInstrument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, active } = req.body;

    const instrument = await Instrument.findById(id);

    if (!instrument) {
      throw new CustomError.NotFoundError("Enstrüman bulunamadı");
    }

    // If name is being updated, check for duplicates
    if (name && name !== instrument.name) {
      const existingInstrument = await Instrument.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      });
      
      if (existingInstrument) {
        throw new CustomError.BadRequestError("Bu enstrüman adı zaten mevcut");
      }
      
      instrument.name = name.trim();
    }

    if (active !== undefined) {
      instrument.active = active;
    }

    await instrument.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Enstrüman başarıyla güncellendi",
      instrument
    });
  } catch (error) {
    next(error);
  }
};

// Delete instrument (admin only)
const deleteInstrument = async (req, res, next) => {
  try {
    const { id } = req.params;

    const instrument = await Instrument.findById(id);

    if (!instrument) {
      throw new CustomError.NotFoundError("Enstrüman bulunamadı");
    }

    // Check if instrument is being used in any listings
    const Listing = require("../models/Listing");
    const listingCount = await Listing.countDocuments({ instrument: id });
    
    if (listingCount > 0) {
      throw new CustomError.BadRequestError("Bu enstrüman kullanılan ilanlarda bulunduğu için silinemez");
    }

    await Instrument.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Enstrüman başarıyla silindi"
    });
  } catch (error) {
    next(error);
  }
};

// Toggle instrument status (admin only)
const toggleInstrumentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const instrument = await Instrument.findById(id);

    if (!instrument) {
      throw new CustomError.NotFoundError("Enstrüman bulunamadı");
    }

    instrument.active = !instrument.active;
    await instrument.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Enstrüman ${instrument.active ? 'aktif' : 'pasif'} olarak güncellendi`,
      instrument
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInstrument,
  getAllInstruments,
  getInstrumentById,
  updateInstrument,
  deleteInstrument,
  toggleInstrumentStatus
};
