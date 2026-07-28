const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  location: { type: String },
  organizer: { type: String },
  eventType: { type: String },
  priority: { type: String, default: 'medium' },
  isPinned: { type: Boolean, default: false }
});

// Explicitly maps to the 'events' collection in CampusPortal
module.exports = mongoose.model('Event', eventSchema, 'events');