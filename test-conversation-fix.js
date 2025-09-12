const mongoose = require('mongoose');
const Conversation = require('./models/Conversation');
const User = require('./models/User');
const Listing = require('./models/Listing');

// Test script to verify the conversation fix
async function testConversationFix() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/bandbul');
    console.log('Connected to MongoDB');

    // Test 1: Check existing conversations
    const allConversations = await Conversation.find({});
    console.log(`\nTotal conversations in database: ${allConversations.length}`);

    // Group by conversationKey
    const conversationGroups = {};
    allConversations.forEach(conv => {
      if (conv.conversationKey) {
        if (!conversationGroups[conv.conversationKey]) {
          conversationGroups[conv.conversationKey] = [];
        }
        conversationGroups[conv.conversationKey].push(conv);
      } else {
        console.log(`Conversation ${conv._id} has no conversationKey`);
      }
    });

    // Check for duplicates
    const duplicates = [];
    Object.keys(conversationGroups).forEach(key => {
      if (conversationGroups[key].length > 1) {
        console.log(`\n❌ Found ${conversationGroups[key].length} conversations with key: ${key}`);
        duplicates.push(...conversationGroups[key]);
      }
    });

    if (duplicates.length === 0) {
      console.log('\n✅ No duplicate conversations found!');
    } else {
      console.log(`\n❌ Found ${duplicates.length} duplicate conversations`);
    }

    // Test 2: Check conversations by participants and listing
    const testUserId1 = '507f1f77bcf86cd799439011'; // Replace with actual user ID
    const testUserId2 = '507f1f77bcf86cd799439012'; // Replace with actual user ID
    const testListingId = '507f1f77bcf86cd799439013'; // Replace with actual listing ID

    const testConversations = await Conversation.find({
      participants: { $all: [testUserId1, testUserId2] }
    }).populate('listing');

    console.log(`\nTest conversations between users ${testUserId1} and ${testUserId2}:`);
    testConversations.forEach((conv, index) => {
      console.log(`  ${index + 1}. Listing: ${conv.listing ? conv.listing.title : 'No listing'} - Key: ${conv.conversationKey || 'No key'}`);
    });

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testConversationFix();
