const ListingCategory = require("../models/ListingCategory");
const mongoose = require("mongoose");

const initialCategories = [
  { name: "Müzisyen Arıyorum" },
  { name: "Ders Veriyorum" },
  { name: "Ders Almak İstiyorum" },
  { name: "Grup Arıyorum" },
  { name: "Enstrüman Satıyorum" },
  { name: "Stüdyo Kiralıyorum" }
];

const seedCategories = async () => {
  try {
    // Connect to MongoDB (you'll need to set your connection string)
    // await mongoose.connect(process.env.MONGO_URL);
    
    console.log("Seeding categories...");
    
    // Clear existing categories
    await ListingCategory.deleteMany({});
    
    // Insert new categories
    const categories = await ListingCategory.insertMany(initialCategories);
    
    console.log(`Successfully seeded ${categories.length} categories:`);
    categories.forEach(cat => {
      console.log(`- ${cat.name} (ID: ${cat._id})`);
    });
    
    // Disconnect
    // await mongoose.disconnect();
    
    console.log("Category seeding completed!");
  } catch (error) {
    console.error("Error seeding categories:", error);
  }
};

// Run seeder if this file is executed directly
if (require.main === module) {
  seedCategories();
}

module.exports = { seedCategories };
