const mongoose = require('mongoose');
const Conversation = require('./models/Conversation');

// Migration script to add conversationKey to existing conversations
async function migrateConversationKeys() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/bandbul');
    console.log('Connected to MongoDB');

    // Find all conversations without conversationKey
    const conversations = await Conversation.find({
      $or: [
        { conversationKey: { $exists: false } },
        { conversationKey: null },
        { conversationKey: '' }
      ]
    });

    console.log(`Found ${conversations.length} conversations without conversationKey`);

    let updated = 0;
    for (const conv of conversations) {
      if (conv.participants.length === 2 && conv.listing) {
        const sortedParticipants = conv.participants.map(p => p.toString()).sort();
        const conversationKey = `${sortedParticipants[0]}-${sortedParticipants[1]}-${conv.listing}`;
        
        try {
          await Conversation.findByIdAndUpdate(conv._id, {
            conversationKey: conversationKey
          });
          updated++;
          console.log(`Updated conversation ${conv._id} with key: ${conversationKey}`);
        } catch (error) {
          console.error(`Failed to update conversation ${conv._id}:`, error.message);
        }
      } else {
        console.log(`Skipping conversation ${conv._id} - invalid participants or listing`);
      }
    }

    console.log(`✅ Migration completed! Updated ${updated} conversations`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrateConversationKeys();
