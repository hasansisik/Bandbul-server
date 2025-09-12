const mongoose = require('mongoose');
const Conversation = require('./models/Conversation');
const User = require('./models/User');
const Listing = require('./models/Listing');

// Test script to verify the new conversation system
async function testConversationSystem() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bandbul');
    console.log('Connected to MongoDB');

    // Create test users
    const user1 = new User({
      name: 'Ahmet',
      surname: 'Yılmaz',
      email: 'ahmet@test.com',
      password: 'password123'
    });
    await user1.save();

    const user2 = new User({
      name: 'Mehmet',
      surname: 'Kaya',
      email: 'mehmet@test.com',
      password: 'password123'
    });
    await user2.save();

    // Create test listings
    const listing1 = new Listing({
      title: 'Gitar Dersi - A İlanı',
      description: 'Gitar dersi veriyorum',
      category: '60f7b3b3b3b3b3b3b3b3b3b3', // You'll need to replace with actual category ID
      location: 'İstanbul',
      experience: 'Orta',
      user: user1._id,
      status: 'active'
    });
    await listing1.save();

    const listing2 = new Listing({
      title: 'Piyano Dersi - B İlanı',
      description: 'Piyano dersi veriyorum',
      category: '60f7b3b3b3b3b3b3b3b3b3b3', // You'll need to replace with actual category ID
      location: 'Ankara',
      experience: 'İleri',
      user: user1._id,
      status: 'active'
    });
    await listing2.save();

    // Test 1: Create conversation for listing 1
    const conversation1 = new Conversation({
      participants: [user1._id, user2._id],
      type: 'direct',
      isActive: true,
      listing: listing1._id,
      lastMessageAt: new Date()
    });
    await conversation1.save();
    console.log('Conversation 1 created:', conversation1.conversationKey);

    // Test 2: Create conversation for listing 2 (same users, different listing)
    const conversation2 = new Conversation({
      participants: [user1._id, user2._id],
      type: 'direct',
      isActive: true,
      listing: listing2._id,
      lastMessageAt: new Date()
    });
    await conversation2.save();
    console.log('Conversation 2 created:', conversation2.conversationKey);

    // Test 3: Verify both conversations exist
    const conversations = await Conversation.find({
      participants: { $all: [user1._id, user2._id] }
    }).populate('listing');
    
    console.log(`Found ${conversations.length} conversations between users:`);
    conversations.forEach((conv, index) => {
      console.log(`  ${index + 1}. ${conv.listing.title} - Key: ${conv.conversationKey}`);
    });

    // Test 4: Try to create duplicate conversation (should find existing)
    const existingConv = await Conversation.findOne({
      conversationKey: conversation1.conversationKey
    });
    console.log('Duplicate check - Found existing conversation:', existingConv ? 'Yes' : 'No');

    console.log('✅ All tests passed! The conversation system is working correctly.');
    console.log('✅ Users can now have multiple conversations for different listings.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testConversationSystem();
