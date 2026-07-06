const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  fullName: { type: String, default: 'Current Student' },
  campusId: { type: String, default: '' },
  text: { type: String, required: true },
  helpful: { type: Number, default: 0 },
  helpfulBy: { type: [String], default: [] }
}, { timestamps: true });

const questionSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['Academic Modules', 'General Enquiries']
  },
  school: { type: String, default: '' },
  module: { type: String, default: '' },
  enquiryTopic: { type: String, default: '' },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  fullName: { type: String, default: 'Current Student' },
  campusId: { type: String, default: '' },
  solved: { type: Boolean, default: false },
  replies: { type: [replySchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);