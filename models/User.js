const mongoose = require('mongoose');

<<<<<<< HEAD
const paymentMethodSchema = new mongoose.Schema({
  type: { type: String, default: '' },
  maskedNumber: { type: String, default: '' },
  brand: { type: String, default: '' }
}, { _id: false });

const financialsSchema = new mongoose.Schema({
  outstandingBalance: { type: Number, default: 0 },
  dueDate: { type: String, default: 'N/A' },
  paymentMethods: { type: [paymentMethodSchema], default: [] }
}, { _id: false });

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, unique: true },
=======
const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    unique: true
  },
>>>>>>> origin/main
  campusId: {
    type: String,
    required: true,
    unique: true,
    match: /^[SEse]\d{7}$/
  },
<<<<<<< HEAD
  password: { type: String, default: '' },
=======
  password: {
    type: String
  },
>>>>>>> origin/main
  role: {
    type: String,
    required: true,
    enum: ['Student', 'Admin'],
    default: 'Student'
  },
<<<<<<< HEAD
  securityQuestion: { type: String, default: '' },
  securityAnswer: { type: String, default: '' },
  recoveryKey: { type: String, default: '' },
  isRegistered: { type: Boolean, default: false },
  course: { type: String, default: 'N/A' },
  school: { type: String, default: 'N/A' },
  personalEmail: { type: String, default: '' },
  campusEmail: { type: String, default: '' },
  contactHome: { type: String, default: '' },
  contactMobile: { type: String, default: '' },
  dob: { type: String, default: '' },
  sex: { type: String, default: '' },
  nationality: { type: String, default: '' },
  address: { type: String, default: '' },
  themePreference: { type: String, enum: ['light', 'dark'], default: 'light' },
  financials: {
    type: financialsSchema,
    default: () => ({
      outstandingBalance: 0,
      dueDate: 'N/A',
      paymentMethods: []
    })
  }
}, { timestamps: false });

module.exports = mongoose.model('User', userSchema);
=======
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
  address: { type: String },
  financials: {
    outstandingBalance: { type: Number, default: 0 },
    dueDate: { type: String, default: "N/A" },
    paymentMethods: { type: Array, default: [] }
  }
});

module.exports = mongoose.model('User', userSchema);
>>>>>>> origin/main
