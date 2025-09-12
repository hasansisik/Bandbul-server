const { User } = require("../models/User");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");
const { createMessageReceivedNotification } = require("./notification");
const { sendToUser, broadcast } = require("../routers/sse");

// Get all conversations for a user
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const conversations = await Conversation.find({
      participants: userId,
      isActive: true
    })
    .populate({
      path: 'participants',
      select: 'name surname profile',
      populate: {
        path: 'profile',
        select: 'picture'
      }
    })
    .populate({
      path: 'lastMessage',
      select: 'content sender createdAt'
    })
    .populate({
      path: 'listing',
      select: 'title image category'
    })
    .sort({ lastMessageAt: -1 });

    // Format conversations for frontend (no duplicate filtering - show all conversations)
    const formattedConversations = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => p._id.toString() !== userId);
      const unreadCount = 0; // We'll implement this later with aggregation

      return {
        id: conv._id,
        name: `${otherParticipant.name} ${otherParticipant.surname}`,
        avatar: otherParticipant.profile?.picture || null,
        lastMessage: conv.lastMessage?.content || 'Henüz mesaj yok',
        timestamp: conv.lastMessageAt,
        unreadCount,
        isOnline: false, // We'll implement this with WebSocket
        listing: conv.listing ? {
          _id: conv.listing._id,
          title: conv.listing.title,
          image: conv.listing.image,
          category: conv.listing.category
        } : null,
        otherParticipant: {
          _id: otherParticipant._id,
          name: otherParticipant.name,
          surname: otherParticipant.surname,
          picture: otherParticipant.profile?.picture
        },
        conversationKey: conv.conversationKey
      };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      conversations: formattedConversations
    });
  } catch (error) {
    next(error);
  }
};

// Get messages for a specific conversation
const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    const { page = 1, limit = 50 } = req.query;

    // Check if user is participant of this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
      isActive: true
    });

    if (!conversation) {
      throw new CustomError.NotFoundError("Konuşma bulunamadı");
    }

    const skip = (page - 1) * limit;

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'name surname profile')
      .populate({
        path: 'sender',
        populate: {
          path: 'profile',
          select: 'picture'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Format messages for frontend
    const formattedMessages = messages.reverse().map(msg => ({
      id: msg._id,
      senderId: msg.sender._id.toString(),
      content: msg.content,
      timestamp: msg.createdAt.toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      isRead: msg.isRead,
      sender: {
        _id: msg.sender._id,
        name: msg.sender.name,
        surname: msg.sender.surname,
        picture: msg.sender.profile?.picture
      }
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      messages: formattedMessages,
      conversation: {
        _id: conversation._id,
        participants: conversation.participants
      }
    });
  } catch (error) {
    next(error);
  }
};

// Send a message
const sendMessage = async (req, res, next) => {
  try {
    const { conversationId, content } = req.body;
    const userId = req.user.userId;

    if (!content || !content.trim()) {
      throw new CustomError.BadRequestError("Mesaj içeriği boş olamaz");
    }

    // Check if conversation exists and user is participant
    let conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
      isActive: true
    });

    if (!conversation) {
      throw new CustomError.NotFoundError("Konuşma bulunamadı");
    }

    // Create new message
    const message = new Message({
      conversation: conversationId,
      sender: userId,
      content: content.trim()
    });

    await message.save();

    // Update conversation's last message
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Populate message data for response
    await message.populate([
      {
        path: 'sender',
        select: 'name surname profile',
        populate: {
          path: 'profile',
          select: 'picture'
        }
      }
    ]);

    // Format message for frontend
    const formattedMessage = {
      id: message._id,
      senderId: message.sender._id.toString(),
      content: message.content,
      timestamp: message.createdAt.toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      isRead: message.isRead,
      sender: {
        _id: message.sender._id,
        name: message.sender.name,
        surname: message.sender.surname,
        picture: message.sender.profile?.picture
      }
    };

    // Send WebSocket notification to conversation participants
    if (global.socketServer) {
      const socketMessage = {
        id: message._id,
        conversationId: conversationId,
        content: message.content,
        sender: {
          _id: message.sender._id,
          name: message.sender.name,
          surname: message.sender.surname,
          picture: message.sender.profile?.picture
        },
        timestamp: message.createdAt.toISOString(),
        isRead: message.isRead
      };
      
      global.socketServer.sendToConversation(conversationId, 'new_message', socketMessage);
    }

    // Send SSE notification to conversation participants
    const sseMessage = {
      id: message._id,
      conversationId: conversationId,
      content: message.content,
      sender: {
        _id: message.sender._id,
        name: message.sender.name,
        surname: message.sender.surname,
        picture: message.sender.profile?.picture
      },
      timestamp: message.createdAt.toISOString(),
      isRead: message.isRead
    };

    // Send to all participants in the conversation
    for (const participantId of conversation.participants) {
      if (participantId.toString() !== userId) {
        sendToUser(participantId.toString(), 'new_message', sseMessage);
      }
    }

    // Create notification for other participants
    try {
      const otherParticipants = conversation.participants.filter(p => p.toString() !== userId);
      const sender = await User.findById(userId).select('name surname');
      const senderName = sender ? `${sender.name} ${sender.surname}` : 'Bilinmeyen';
      
      for (const participantId of otherParticipants) {
        await createMessageReceivedNotification(
          participantId, 
          conversationId, 
          senderName, 
          content
        );
      }
    } catch (notificationError) {
      console.error('Message notification creation failed:', notificationError);
      // Don't fail message sending if notification creation fails
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: formattedMessage,
      conversation: {
        _id: conversation._id,
        participants: conversation.participants
      }
    });
  } catch (error) {
    next(error);
  }
};

// Start a new conversation
const startConversation = async (req, res, next) => {
  try {
    const { recipientId, listingId } = req.body;
    const userId = req.user.userId;

    if (!recipientId) {
      throw new CustomError.BadRequestError("Alıcı ID gereklidir");
    }

    if (!listingId) {
      throw new CustomError.BadRequestError("İlan ID gereklidir");
    }

    if (recipientId === userId) {
      throw new CustomError.BadRequestError("Kendinizle konuşma başlatamazsınız");
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      throw new CustomError.NotFoundError("Alıcı bulunamadı");
    }

    // Check if listing exists
    const Listing = require("../models/Listing");
    const listing = await Listing.findById(listingId);
    if (!listing) {
      throw new CustomError.NotFoundError("İlan bulunamadı");
    }

    // Sort participants to ensure consistent order
    const sortedParticipants = [userId, recipientId].sort();
    const conversationKey = `${sortedParticipants[0]}-${sortedParticipants[1]}-${listingId}`;

    // Check if conversation already exists for this specific listing
    let conversation = await Conversation.findOne({
      conversationKey: conversationKey
    });

    // Fallback: if conversationKey lookup fails, try by participants and listing
    if (!conversation) {
      conversation = await Conversation.findOne({
        participants: { $all: sortedParticipants, $size: 2 },
        listing: listingId,
        type: 'direct',
        isActive: true
      });
    }

    if (!conversation) {
      // Use findOneAndUpdate with upsert to prevent race conditions
      try {
        conversation = await Conversation.findOneAndUpdate(
          {
            conversationKey: conversationKey
          },
          {
            participants: sortedParticipants,
            type: 'direct',
            isActive: true,
            lastMessageAt: new Date(),
            listing: listingId,
            conversationKey: conversationKey
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
          }
        );
      } catch (error) {
        // If upsert fails, try to find existing conversation
        conversation = await Conversation.findOne({
          conversationKey: conversationKey
        });
        
        // Fallback: if conversationKey lookup fails, try by participants and listing
        if (!conversation) {
          conversation = await Conversation.findOne({
            participants: { $all: sortedParticipants, $size: 2 },
            listing: listingId,
            type: 'direct',
            isActive: true
          });
        }
        
        if (!conversation) {
          throw new CustomError.BadRequestError("Konuşma oluşturulamadı");
        }
      }
    }

    // Add conversation to both users
    await User.findByIdAndUpdate(userId, {
      $addToSet: { conversations: conversation._id }
    });
    await User.findByIdAndUpdate(recipientId, {
      $addToSet: { conversations: conversation._id }
    });

    // Populate conversation data
    await conversation.populate([
      {
        path: 'participants',
        select: 'name surname profile',
        populate: {
          path: 'profile',
          select: 'picture'
        }
      },
      {
        path: 'listing',
        select: 'title image category'
      }
    ]);

    const otherParticipant = conversation.participants.find(p => p._id.toString() !== userId);

    const formattedConversation = {
      id: conversation._id,
      name: `${otherParticipant.name} ${otherParticipant.surname}`,
      avatar: otherParticipant.profile?.picture || null,
      lastMessage: 'Henüz mesaj yok',
      timestamp: conversation.createdAt,
      unreadCount: 0,
      isOnline: false,
      listing: conversation.listing ? {
        _id: conversation.listing._id,
        title: conversation.listing.title,
        image: conversation.listing.image,
        category: conversation.listing.category
      } : null,
      otherParticipant: {
        _id: otherParticipant._id,
        name: otherParticipant.name,
        surname: otherParticipant.surname,
        picture: otherParticipant.profile?.picture
      },
      conversationKey: conversation.conversationKey
    };

    res.status(StatusCodes.CREATED).json({
      success: true,
      conversation: formattedConversation
    });
  } catch (error) {
    next(error);
  }
};


// Mark messages as read
const markAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    // Check if user is participant of this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
      isActive: true
    });

    if (!conversation) {
      throw new CustomError.NotFoundError("Konuşma bulunamadı");
    }

    // Mark all unread messages in this conversation as read
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Mesajlar okundu olarak işaretlendi"
    });
  } catch (error) {
    next(error);
  }
};

// Get unread message count
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const unreadCount = await Message.countDocuments({
      conversation: { $in: await Conversation.find({ participants: userId }).distinct('_id') },
      sender: { $ne: userId },
      isRead: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

// Poll for new messages (for production polling)
const pollMessages = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 60000); // Default to last minute

    // Get user's conversations
    const conversations = await Conversation.find({
      participants: userId,
      isActive: true
    }).distinct('_id');

    // Get new messages since the given time
    const messages = await Message.find({
      conversation: { $in: conversations },
      sender: { $ne: userId },
      createdAt: { $gt: since }
    })
    .populate([
      {
        path: 'sender',
        select: 'name surname profile',
        populate: {
          path: 'profile',
          select: 'picture'
        }
      },
      {
        path: 'conversation',
        select: 'participants'
      }
    ])
    .sort({ createdAt: 1 });

    // Format messages for frontend
    const formattedMessages = messages.map(message => ({
      id: message._id,
      conversationId: message.conversation._id,
      content: message.content,
      sender: {
        _id: message.sender._id,
        name: message.sender.name,
        surname: message.sender.surname,
        picture: message.sender.profile?.picture
      },
      timestamp: message.createdAt.toISOString(),
      isRead: message.isRead
    }));

    res.status(StatusCodes.OK).json({ 
      success: true,
      messages: formattedMessages,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

// Cleanup duplicate conversations utility
const cleanupDuplicateConversations = async (req, res, next) => {
  try {
    // Find all active conversations
    const conversations = await Conversation.find({
      type: 'direct',
      isActive: true
    }).sort({ createdAt: -1 });

    const seenPairs = new Set();
    const duplicates = [];

    for (const conv of conversations) {
      const sortedParticipants = conv.participants.map(p => p.toString()).sort();
      const pairKey = sortedParticipants.join('-');
      
      if (seenPairs.has(pairKey)) {
        duplicates.push(conv._id);
      } else {
        seenPairs.add(pairKey);
      }
    }

    if (duplicates.length > 0) {
      // Delete messages from duplicate conversations
      await Message.deleteMany({ conversation: { $in: duplicates } });
      
      // Remove duplicates from users' conversations arrays
      await User.updateMany(
        { conversations: { $in: duplicates } },
        { $pull: { conversations: { $in: duplicates } } }
      );

      // Delete duplicate conversations
      await Conversation.deleteMany({ _id: { $in: duplicates } });

      res.status(StatusCodes.OK).json({
        success: true,
        message: `Cleaned up ${duplicates.length} duplicate conversations`,
        removedConversations: duplicates
      });
    } else {
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'No duplicate conversations found'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Remove unique index from conversations collection
const removeUniqueIndex = async (req, res, next) => {
  try {
    const db = Conversation.db;
    const collection = db.collection('conversations');
    
    // List all indexes
    const indexes = await collection.indexes();
    
    // Drop the unique index
    try {
      await collection.dropIndex('unique_participants_per_type');
    } catch (error) {
    }
    
    // List indexes again to verify
    const newIndexes = await collection.indexes();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Unique index removed successfully',
      remainingIndexes: newIndexes.map(index => ({
        name: index.name,
        keys: index.key
      }))
    });
  } catch (error) {
    console.error('Error removing index:', error);
    next(error);
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  startConversation,
  markAsRead,
  getUnreadCount,
  pollMessages,
  cleanupDuplicateConversations,
  removeUniqueIndex
};