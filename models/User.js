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
    type: String
  },
  role: {
    type: String,
    required: true,
    enum: ['Student', 'Admin'],
    default: 'Student'
  },
  securityQuestion: {
    type: String
  },
  securityAnswer: {
    type: String
  },
  recoveryKey: {
    type: String
  },
  isRegistered: {
    type: Boolean,
    default: false
  },
  course: { type: String },
  school: { type: String },
  personalEmail: { type: String },
  campusEmail: { type: String },
  contactHome: { type: String },
  contactMobile: { type: String },
  dob: { type: String },
  sex: { type: String },
  nationality: { type: String },
  address: { type: String }
});

module.exports = mongoose.model('User', userSchema);
