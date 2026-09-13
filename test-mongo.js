require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function test() {
  console.log('Connecting to', process.env.MONGODB_URI);
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      family: 4,
      serverSelectionTimeoutMS: 5000
    });
    console.log('Connected!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
test();
