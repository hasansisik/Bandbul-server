const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { User } = require('../models/User');

const cleanupDuplicates = async () => {
  try {
    
    // Connect to MongoDB (try local first)
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/bandbul';
    await mongoose.connect(mongoUrl);

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
      const deletedMessages = await Message.deleteMany({ conversation: { $in: duplicates } });
      
      // Remove duplicates from users' conversations arrays
      const userUpdate = await User.updateMany(
        { conversations: { $in: duplicates } },
        { $pull: { conversations: { $in: duplicates } } }
      );

      // Delete duplicate conversations
      const deletedConversations = await Conversation.deleteMany({ _id: { $in: duplicates } });

    } else {
    }

    // Show final stats
    const finalCount = await Conversation.countDocuments({ type: 'direct', isActive: true });

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

// Run the cleanup
cleanupDuplicates();
