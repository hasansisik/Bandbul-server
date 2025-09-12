const mongoose = require('mongoose');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const User = require('./models/User');

// Cleanup script to remove duplicate conversations
async function cleanupDuplicates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bandbul');
    console.log('Connected to MongoDB');

    // Find all conversations
    const conversations = await Conversation.find({}).sort({ createdAt: -1 });
    console.log(`Found ${conversations.length} total conversations`);

    // Group conversations by conversationKey
    const conversationGroups = {};
    conversations.forEach(conv => {
      if (conv.conversationKey) {
        if (!conversationGroups[conv.conversationKey]) {
          conversationGroups[conv.conversationKey] = [];
        }
        conversationGroups[conv.conversationKey].push(conv);
      }
    });

    // Find duplicates
    const duplicates = [];
    Object.keys(conversationGroups).forEach(key => {
      if (conversationGroups[key].length > 1) {
        console.log(`Found ${conversationGroups[key].length} conversations with key: ${key}`);
        // Keep the first one (most recent), mark others as duplicates
        const sorted = conversationGroups[key].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        duplicates.push(...sorted.slice(1));
      }
    });

    console.log(`Found ${duplicates.length} duplicate conversations to remove`);

    if (duplicates.length > 0) {
      // Get IDs of duplicate conversations
      const duplicateIds = duplicates.map(conv => conv._id);
      
      // Delete messages from duplicate conversations
      const deletedMessages = await Message.deleteMany({ 
        conversation: { $in: duplicateIds } 
      });
      console.log(`Deleted ${deletedMessages.deletedCount} messages from duplicate conversations`);

      // Remove duplicate conversations from users' conversations arrays
      const updatedUsers = await User.updateMany(
        { conversations: { $in: duplicateIds } },
        { $pull: { conversations: { $in: duplicateIds } } }
      );
      console.log(`Updated ${updatedUsers.modifiedCount} users to remove duplicate conversations`);

      // Delete duplicate conversations
      const deletedConversations = await Conversation.deleteMany({ 
        _id: { $in: duplicateIds } 
      });
      console.log(`Deleted ${deletedConversations.deletedCount} duplicate conversations`);

      console.log('✅ Cleanup completed successfully!');
    } else {
      console.log('✅ No duplicate conversations found!');
    }

    // Verify the cleanup
    const remainingConversations = await Conversation.find({});
    console.log(`Remaining conversations: ${remainingConversations.length}`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupDuplicates();
