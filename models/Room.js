const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  amenities: {
    type: [String],
    default: []
  }
});

module.exports = mongoose.model('Room', roomSchema);