const Contact = require("../models/Contact");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");

// Create new contact message (public - no authentication required)
const createContact = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      subject,
      message
    } = req.body;

    // Create the contact message
    const contact = new Contact({
      name,
      email,
      phone,
      subject,
      message
    });

    await contact.save();

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Mesajınız başarıyla gönderildi",
      contact
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Get all contact messages (admin only)
const getAllContacts = async (req, res, next) => {
  try {
    const { 
      status, 
      priority, 
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get contacts with pagination
    const contacts = await Contact.find(filter)
      .populate('repliedByInfo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Contact.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      contacts,
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

// Get single contact by ID (admin only)
const getContactById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findById(id)
      .populate('repliedByInfo');

    if (!contact) {
      throw new CustomError.NotFoundError("İletişim mesajı bulunamadı");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      contact
    });
  } catch (error) {
    next(error);
  }
};

// Update contact message (admin only)
const updateContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const contact = await Contact.findById(id);

    if (!contact) {
      throw new CustomError.NotFoundError("İletişim mesajı bulunamadı");
    }

    const updates = Object.keys(req.body);
    const allowedUpdates = [
      'status', 'priority', 'adminNotes', 'repliedBy', 'repliedAt'
    ];

    const isValidOperation = updates.every(update => 
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      throw new CustomError.BadRequestError("Geçersiz güncelleme alanları");
    }

    // Update fields
    updates.forEach(update => {
      contact[update] = req.body[update];
    });

    // If status is being updated to 'replied', set repliedBy and repliedAt
    if (req.body.status === 'replied' && !contact.repliedBy) {
      contact.repliedBy = userId;
      contact.repliedAt = new Date();
    }

    await contact.save();

    // Populate replied by user info
    await contact.populate('repliedByInfo');

    res.status(StatusCodes.OK).json({
      success: true,
      message: "İletişim mesajı başarıyla güncellendi",
      contact
    });
  } catch (error) {
    next(error);
  }
};

// Delete contact message (admin only)
const deleteContact = async (req, res, next) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findById(id);

    if (!contact) {
      throw new CustomError.NotFoundError("İletişim mesajı bulunamadı");
    }

    // Delete the contact
    await Contact.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "İletişim mesajı başarıyla silindi"
    });
  } catch (error) {
    console.error("Delete contact error:", error);
    next(error);
  }
};

// Update contact status (admin only)
const updateContactStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, priority, adminNotes } = req.body;
    const userId = req.user.userId;

    const contact = await Contact.findById(id);

    if (!contact) {
      throw new CustomError.NotFoundError("İletişim mesajı bulunamadı");
    }

    // Update status and priority
    if (status) contact.status = status;
    if (priority) contact.priority = priority;
    if (adminNotes !== undefined) contact.adminNotes = adminNotes;

    // If status is being updated to 'replied', set repliedBy and repliedAt
    if (status === 'replied' && !contact.repliedBy) {
      contact.repliedBy = userId;
      contact.repliedAt = new Date();
    }

    await contact.save();

    // Populate replied by user info
    await contact.populate('repliedByInfo');

    res.status(StatusCodes.OK).json({
      success: true,
      message: "İletişim mesajı durumu güncellendi",
      contact
    });
  } catch (error) {
    next(error);
  }
};

// Get contact statistics (admin only)
const getContactStats = async (req, res, next) => {
  try {
    const stats = await Contact.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          new: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] } },
          replied: { $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
          urgent: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } }
        }
      }
    ]);

    const monthlyStats = await Contact.aggregate([
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
        new: 0,
        read: 0,
        replied: 0,
        closed: 0,
        urgent: 0,
        high: 0
      },
      monthlyStats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createContact,
  getAllContacts,
  getContactById,
  updateContact,
  deleteContact,
  updateContactStatus,
  getContactStats
};
