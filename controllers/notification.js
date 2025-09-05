const Notification = require("../models/Notification");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");
const mongoose = require("mongoose");

// Create new notification (system only)
const createNotification = async (req, res, next) => {
  try {
    const {
      userId,
      type,
      title,
      message,
      data = {},
      listingId,
      conversationId,
      systemAction
    } = req.body;

    // Create the notification
    const notification = new Notification({
      user: userId,
      type,
      title,
      message,
      data,
      listingId,
      conversationId,
      systemAction
    });

    await notification.save();

    // Populate user info
    await notification.populate('userInfo');

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Bildirim başarıyla oluşturuldu",
      notification
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Get all notifications for a user
const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { 
      page = 1,
      limit = 20,
      isRead,
      type
    } = req.query;

    // Build filter object
    const filter = {
      user: userId,
      isDeleted: false
    };
    
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    if (type) filter.type = type;

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get notifications with pagination
    const notifications = await Notification.find(filter)
      .populate('userInfo', 'name surname picture')
      .populate('listingInfo', 'title image category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Notification.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      notifications,
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

// Get single notification by ID
const getNotificationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOne({
      _id: id,
      user: userId,
      isDeleted: false
    })
      .populate('userInfo', 'name surname picture')
      .populate('listingInfo', 'title image category');

    if (!notification) {
      throw new CustomError.NotFoundError("Bildirim bulunamadı");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      notification
    });
  } catch (error) {
    next(error);
  }
};

// Mark notification as read
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId, isDeleted: false },
      { isRead: true },
      { new: true }
    ).populate('userInfo', 'name surname picture');

    if (!notification) {
      throw new CustomError.NotFoundError("Bildirim bulunamadı");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Bildirim okundu olarak işaretlendi",
      notification
    });
  } catch (error) {
    next(error);
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    await Notification.updateMany(
      { user: userId, isDeleted: false, isRead: false },
      { isRead: true }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Tüm bildirimler okundu olarak işaretlendi"
    });
  } catch (error) {
    next(error);
  }
};

// Delete notification (soft delete)
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!notification) {
      throw new CustomError.NotFoundError("Bildirim bulunamadı");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Bildirim silindi"
    });
  } catch (error) {
    next(error);
  }
};

// Get notification statistics
const getNotificationStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Validate ObjectId format
    if (!mongoose.isValidObjectId(userId)) {
      throw new CustomError.BadRequestError("Geçersiz kullanıcı ID'si");
    }

    const stats = await Notification.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] } },
          welcome: { $sum: { $cond: [{ $eq: ['$type', 'welcome'] }, 1, 0] } },
          listing_created: { $sum: { $cond: [{ $eq: ['$type', 'listing_created'] }, 1, 0] } },
          listing_approved: { $sum: { $cond: [{ $eq: ['$type', 'listing_approved'] }, 1, 0] } },
          listing_rejected: { $sum: { $cond: [{ $eq: ['$type', 'listing_rejected'] }, 1, 0] } },
          message_received: { $sum: { $cond: [{ $eq: ['$type', 'message_received'] }, 1, 0] } },
          system: { $sum: { $cond: [{ $eq: ['$type', 'system'] }, 1, 0] } }
        }
      }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      stats: stats[0] || {
        total: 0,
        unread: 0,
        read: 0,
        welcome: 0,
        listing_created: 0,
        listing_approved: 0,
        listing_rejected: 0,
        message_received: 0,
        system: 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// System function to create welcome notification
const createWelcomeNotification = async (userId) => {
  try {
    const notification = new Notification({
      user: userId,
      type: 'welcome',
      title: 'Hoş Geldiniz! 🎉',
      message: 'Bandbul\'a hoş geldiniz! Profilinizi tamamlayarak ilanlarınızı paylaşmaya başlayabilirsiniz.',
      systemAction: 'welcome',
      data: {
        action: 'welcome',
        message: 'Hoş geldiniz bildirimi'
      }
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Welcome notification creation error:', error);
    throw error;
  }
};

// System function to create listing created notification
const createListingCreatedNotification = async (userId, listingId, listingTitle) => {
  try {
    const notification = new Notification({
      user: userId,
      type: 'listing_created',
      title: 'İlanınız Oluşturuldu! 📝',
      message: `"${listingTitle}" başlıklı ilanınız başarıyla oluşturuldu ve onay bekliyor.`,
      listingId,
      systemAction: 'listing_created',
      data: {
        action: 'listing_created',
        listingTitle,
        message: 'İlan oluşturuldu bildirimi'
      }
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Listing created notification error:', error);
    throw error;
  }
};

// System function to create message received notification
const createMessageReceivedNotification = async (userId, conversationId, senderName, messagePreview) => {
  try {
    const notification = new Notification({
      user: userId,
      type: 'message_received',
      title: `Yeni Mesaj - ${senderName}`,
      message: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
      conversationId,
      systemAction: 'message_received',
      data: {
        action: 'message_received',
        senderName,
        messagePreview,
        message: 'Yeni mesaj bildirimi'
      }
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Message received notification error:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats,
  // System functions
  createWelcomeNotification,
  createListingCreatedNotification,
  createMessageReceivedNotification
};
