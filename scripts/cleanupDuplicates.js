const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { User } = require('../models/User');

const cleanupDuplicates = async () => {
  try {
    console.log('🔄 Starting duplicate conversation cleanup...');
    
    // Connect to MongoDB (try local first)
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/bandbul';
    await mongoose.connect(mongoUrl);
    console.log('✅ Connected to MongoDB');

    // Find all active conversations
    const conversations = await Conversation.find({
      type: 'direct',
      isActive: true
    }).sort({ createdAt: -1 });

    console.log(`📊 Found ${conversations.length} total conversations`);

    const seenPairs = new Set();
    const duplicates = [];

    for (const conv of conversations) {
      const sortedParticipants = conv.participants.map(p => p.toString()).sort();
      const pairKey = sortedParticipants.join('-');
      
      if (seenPairs.has(pairKey)) {
        duplicates.push(conv._id);
        console.log(`🔍 Found duplicate: ${conv._id} for participants ${pairKey}`);
      } else {
        seenPairs.add(pairKey);
      }
    }

    if (duplicates.length > 0) {
      console.log(`🗑️  Removing ${duplicates.length} duplicate conversations...`);
      
      // Delete messages from duplicate conversations
      const deletedMessages = await Message.deleteMany({ conversation: { $in: duplicates } });
      console.log(`📨 Deleted ${deletedMessages.deletedCount} messages from duplicates`);
      
      // Remove duplicates from users' conversations arrays
      const userUpdate = await User.updateMany(
        { conversations: { $in: duplicates } },
        { $pull: { conversations: { $in: duplicates } } }
      );
      console.log(`👥 Updated ${userUpdate.modifiedCount} users' conversation lists`);

      // Delete duplicate conversations
      const deletedConversations = await Conversation.deleteMany({ _id: { $in: duplicates } });
      console.log(`🗑️  Deleted ${deletedConversations.deletedCount} duplicate conversations`);

      console.log('✅ Cleanup completed successfully!');
    } else {
      console.log('✅ No duplicate conversations found!');
    }

    // Show final stats
    const finalCount = await Conversation.countDocuments({ type: 'direct', isActive: true });
    console.log(`📈 Final conversation count: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the cleanup
cleanupDuplicates();
