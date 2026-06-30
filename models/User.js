const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    unique: true
  },
  campusId: {
    type: String,
    required: true,
    unique: true,
    match: /^[SEse]\d{7}$/
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    enum: ['Student', 'Admin'],
    default: 'Student'
  },
  securityQuestion: {
    type: String,
    required: true
  },
  securityAnswer: {
    type: String,
    required: true
  },
  recoveryKey: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('User', userSchema);
