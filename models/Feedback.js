const mongoose = require('mongoose');

// No name/id/role field on purpose — feedback stays anonymous in storage,
// even though we know internally only a logged-in student could submit it.
const feedbackSchema = new mongoose.Schema({
    category: { type: String, default: 'General' },
    message: { type: String, required: true },
    date: { type: String, required: true } // display string, e.g. "7/11/2026"
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
