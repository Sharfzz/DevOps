const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, required: true },          // e.g. 'IT', 'Facility'
    assignedTo: { type: String, required: true },     // e.g. 'IT Helpdesk' — the department it's routed to
    overridden: { type: Boolean, default: false },    // true once an admin manually reassigns it
    location: { type: String, default: 'Unspecified' },
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    priorityWeight: { type: Number, required: true }, // 0=High, 1=Medium, 2=Low — lets MongoDB sort by priority directly
    status: { type: String, default: 'Open' },
    description: { type: String, required: true },
    raisedBy: { type: String, required: true },
    raisedByRole: { type: String, required: true },
    date: { type: String, required: true }            // display string, e.g. "7/11/2026"
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
