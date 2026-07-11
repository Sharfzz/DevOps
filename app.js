require('dotenv').config();

const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const Feedback = require('./models/Feedback');
const Ticket = require('./models/Ticket');

const app = express();
const PORT = 8080;

// Tell Express to use EJS as the templating engine
app.set('view engine', 'ejs');

// Parse form submissions (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// SESSION SETUP — real sessions via express-session. If your teammate's login
// system already sets this up elsewhere, don't duplicate it here — there
// should only be ONE app.use(session(...)) in the merged app.
// Everything below only depends on `req.session.user` existing as
// { id, name, role }, set by the /login route after checking credentials —
// role must be exactly 'student', 'staff', or 'admin'.
// ============================================================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'campus-portal-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hour login
}));

// Makes the logged-in user (or null) available in every EJS view as currentUser
app.use((req, res, next) => {
    res.locals.currentUser = (req.session && req.session.user) || null;
    next();
});

// Blocks anyone who isn't logged in
function requireLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).render('feedback', {
            feedbackList: [],
            tickets: [],
            authError: 'You must be logged in to view this page.'
        });
    }
    next();
}

// Blocks logged-in users whose role isn't in the allowed list
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user || !roles.includes(req.session.user.role)) {
            return res.status(403).send('You do not have permission to do that.');
        }
        next();
    };
}

// Which team a ticket type gets routed to by default. Admins can override
// this per-ticket, so it's a *suggestion*, not the final word.
const TICKET_ROUTES = {
    IT: 'IT Helpdesk',
    Facility: 'Facilities Team',
    Security: 'Campus Security',
    Academic: 'Academic Affairs Office'
};

// Full list of departments an admin can push a ticket to, regardless of type.
const DEPARTMENTS = Object.values(TICKET_ROUTES);

// Maps priority labels to a sort weight so High always appears first in Mongo queries
const PRIORITY_WEIGHT = { High: 0, Medium: 1, Low: 2 };

// When a user visits the root URL ('/'), render the index.ejs file
app.get('/', (req, res) => {
    res.render('index');
});

// Feedback & ticketing hub — must be logged in to view.
// Feedback itself is staff/admin-only; students submit blind and never see
// the list (that's what keeps it meaningfully anonymous, not just untitled).
app.get('/feedback', requireLogin, async (req, res) => {
    try {
        const canViewFeedback = ['staff', 'admin'].includes(req.session.user.role);

        const [feedbackList, tickets] = await Promise.all([
            canViewFeedback ? Feedback.find().sort({ createdAt: -1 }) : Promise.resolve([]),
            Ticket.find().sort({ priorityWeight: 1, createdAt: -1 })
        ]);

        res.render('feedback', {
            feedbackList,
            canViewFeedback,
            tickets,
            ticketTypes: Object.keys(TICKET_ROUTES),
            departments: DEPARTMENTS
        });
    } catch (err) {
        console.error('Error loading /feedback:', err);
        res.status(500).send('Something went wrong loading the feedback page.');
    }
});

// Handle student feedback submissions — students only, and always anonymous
app.post('/feedback/student', requireLogin, requireRole('student'), async (req, res) => {
    try {
        const { category, message } = req.body;

        if (message && message.trim()) {
            await Feedback.create({
                category: category || 'General',
                message: message.trim(),
                date: new Date().toLocaleDateString()
                // Deliberately no name/id/role stored, so feedback stays anonymous
                // even though we know internally that only a logged-in student
                // could have submitted it.
            });
        }

        res.redirect('/feedback#feedback-panel');
    } catch (err) {
        console.error('Error saving feedback:', err);
        res.status(500).send('Could not save your feedback. Please try again.');
    }
});

// Handle facility/IT/etc. ticket submissions — any logged-in student or staff
app.post('/feedback/ticket', requireLogin, requireRole('student', 'staff'), async (req, res) => {
    try {
        const { title, type, location, priority, description } = req.body;
        const resolvedType = TICKET_ROUTES.hasOwnProperty(type) ? type : 'Facility';
        const resolvedPriority = PRIORITY_WEIGHT.hasOwnProperty(priority) ? priority : 'Medium';

        if (title && title.trim() && description && description.trim()) {
            await Ticket.create({
                title: title.trim(),
                type: resolvedType,
                assignedTo: TICKET_ROUTES[resolvedType], // auto-suggested; admin can override below
                overridden: false,
                location: (location && location.trim()) || 'Unspecified',
                priority: resolvedPriority,
                priorityWeight: PRIORITY_WEIGHT[resolvedPriority],
                status: 'Open',
                description: description.trim(),
                raisedBy: req.session.user.name,
                raisedByRole: req.session.user.role,
                date: new Date().toLocaleDateString()
            });
        }

        res.redirect('/feedback#ticket-panel');
    } catch (err) {
        console.error('Error saving ticket:', err);
        res.status(500).send('Could not save your ticket. Please try again.');
    }
});

// Admin-only: push/reassign a ticket to a different department than the
// auto-suggested one. This doesn't touch `type`, only where it's routed.
app.post('/feedback/ticket/:id/assign', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const { assignedTo } = req.body;
        const ticket = await Ticket.findById(req.params.id);

        if (ticket && DEPARTMENTS.includes(assignedTo)) {
            ticket.overridden = assignedTo !== TICKET_ROUTES[ticket.type];
            ticket.assignedTo = assignedTo;
            await ticket.save();
        }

        res.redirect('/feedback#ticket-panel');
    } catch (err) {
        console.error('Error reassigning ticket:', err);
        res.status(500).send('Could not reassign this ticket. Please try again.');
    }
});

// Connect to MongoDB, then start the server only once the connection is live
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Server is running successfully on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Failed to connect to MongoDB:', err.message);
        process.exit(1);
    });
