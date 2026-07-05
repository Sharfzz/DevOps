const crypto = require('crypto');
const bcrypt = require('bcrypt');
const session = require('express-session');
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
console.log('Debug - MONGO_URI exists:', !!process.env.MONGO_URI);
const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/User');
const app = express();

mongoose.connect(process.env.MONGO_URI, { family: 4 })
    .then(() => console.log(' MongoDB Connected Successfully to CampusPortal!'))
    .catch(err => console.error(' MongoDB Connection Error:', err));
const PORT = 8080;

// Tell Express to use EJS as the templating engine
app.set('view engine', 'ejs');

// Serve static files from the public directory
app.use(express.static('public'));

// Middleware to parse URL-encoded bodies (form data)
app.use(express.urlencoded({ extended: true }));

// Setup Session Middleware
app.use(session({
    secret: 'campus-portal-secret',
    resave: false,
    saveUninitialized: true
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Auth routes
app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        const user = await User.findById(req.session.user.id);
        res.render('index', { profile: user });
    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    try {
        const { campusId, password } = req.body;

        if (typeof campusId !== 'string' || typeof password !== 'string') {
            return res.status(400).send('Invalid input format');
        }

        const user = await User.findOne({ campusId });

        if (!user) {
            return res.status(401).send('Invalid Credentials');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).send('Invalid Credentials');
        }

        req.session.user = {
            id: user._id,
            role: user.role,
            fullName: user.fullName,
            campusId: user.campusId,
            securityQuestion: user.securityQuestion,
            recoveryKey: user.recoveryKey
        };

        res.redirect('/');
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/register', (req, res) => {
    res.render('register', { error: null, fullName: '', campusId: '', role: '', securityQuestion: '', securityAnswer: '' });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});



app.post('/register', async (req, res) => {
    try {
        const { fullName, campusId, password, securityQuestion, securityAnswer, role } = req.body;
        const cleanId = campusId.trim();
        const cleanName = fullName.trim();

        if (role === 'Student' && cleanId.startsWith('E')) {
            return res.render('register', { 
                error: "Role mismatch: 'E' IDs are reserved for Staff.",
                fullName: req.body.fullName,
                campusId: req.body.campusId,
                role: req.body.role,
                securityQuestion: req.body.securityQuestion,
                securityAnswer: req.body.securityAnswer
            });
        }
        if (role === 'Admin' && cleanId.startsWith('S')) {
            return res.render('register', { 
                error: "Role mismatch: 'S' IDs are reserved for Students.",
                fullName: req.body.fullName,
                campusId: req.body.campusId,
                role: req.body.role,
                securityQuestion: req.body.securityQuestion,
                securityAnswer: req.body.securityAnswer
            });
        }

        // 1. Block if already activated
        const alreadyActive = await User.findOne({ campusId: cleanId, isRegistered: true });
        if (alreadyActive) {
            return res.render('register', { 
                error: "This Campus ID has already been registered and activated.",
                fullName: req.body.fullName,
                campusId: req.body.campusId,
                role: req.body.role,
                securityQuestion: req.body.securityQuestion,
                securityAnswer: req.body.securityAnswer
            });
        }

        // 2. Find the pre-approved whitelist entry matching ID, Name, AND Role
        const whitelistUser = await User.findOne({
            campusId: cleanId,
            fullName: cleanName,
            role: role, // Crucial security fix: Enforce role mapping
            isRegistered: false
        });

        // 3. Reject if not on the whitelist
        if (!whitelistUser) {
            return res.render('register', { 
                error: "Identity verification failed. Your ID and name do not match our campus directory enrollment logs.",
                fullName: req.body.fullName,
                campusId: req.body.campusId,
                role: req.body.role,
                securityQuestion: req.body.securityQuestion,
                securityAnswer: req.body.securityAnswer
            });
        }

        // 4. Activate the account
        const salt = await bcrypt.genSalt(10);
        whitelistUser.password = await bcrypt.hash(password, salt);
        whitelistUser.securityQuestion = securityQuestion;
        whitelistUser.securityAnswer = securityAnswer;
        
        // Generate recovery key (using crypto)
        const crypto = require('crypto');
        whitelistUser.recoveryKey = "CP-" + crypto.randomBytes(4).toString('hex').toUpperCase();
        
        // Flip the activation switch
        whitelistUser.isRegistered = true;
        await whitelistUser.save();

        res.redirect('/login');

    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).send("Server Error during registration");
    }
});

app.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});

app.post('/forgot-password', async (req, res) => {
    try {
        const { campusId, recoveryMethod, recoveryKey, securityAnswer } = req.body;
        let user;

        if (recoveryMethod === 'key') {
            user = await User.findOne({ campusId, recoveryKey });
        } else if (recoveryMethod === 'question') {
            user = await User.findOne({ campusId, securityAnswer });
        } else {
            user = await User.findOne({ campusId, $or: [{ recoveryKey: recoveryKey || '' }, { securityAnswer: securityAnswer || '' }] });
        }

        if (user) {
            req.session.resetUserId = user._id;
            res.redirect('/reset-password');
        } else {
            res.status(401).send('Invalid ID or Recovery Information.');
        }
    } catch (err) {
        console.error('Forgot Password Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/reset-password', (req, res) => {
    if (!req.session.resetUserId) {
        return res.redirect('/login');
    }
    res.render('reset-password');
});

app.post('/reset-password', async (req, res) => {
    try {
        if (!req.session.resetUserId) {
            return res.redirect('/login');
        }

        const { newPassword, confirmPassword } = req.body;
        if (newPassword !== confirmPassword) {
            return res.status(400).send('Passwords do not match');
        }

        const user = await User.findById(req.session.resetUserId);
        if (!user) {
            return res.status(404).send('User not found');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        req.session.resetUserId = null;
        res.redirect('/login');
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/profile', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) {
            req.session.destroy();
            return res.redirect('/login');
        }
        res.render('profile', { userProfile: user });
    } catch (err) {
        console.error('Profile Fetch Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/profile/regenerate-key', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        const newKey = 'CP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        await User.findByIdAndUpdate(req.session.user.id, { recoveryKey: newKey });
        res.redirect('/profile');
    } catch (err) {
        console.error('Regenerate Key Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/admin/helpdesk', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'Admin') {
        return res.status(403).send('Forbidden: Admins Only');
    }
    try {
        const users = await User.find({});
        res.render('admin-helpdesk', { users });
    } catch (err) {
        console.error('Admin Fetch Users Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/admin/reset-user', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'Admin') {
        return res.status(403).send('Forbidden: Admins Only');
    }
    try {
        const { targetUserId } = req.body;
        const newPassword = 'Campus123!';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        const newKey = 'CP-' + crypto.randomBytes(4).toString('hex').toUpperCase();

        await User.findByIdAndUpdate(targetUserId, {
            password: hashedPassword,
            recoveryKey: newKey
        });

        res.redirect('/admin/helpdesk');
    } catch (err) {
        console.error('Admin Reset Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/financial', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== 'Student') return res.redirect('/');
    const user = await User.findById(req.session.user.id);
    res.render('financial', { userProfile: user });
});

app.post('/financial/pay', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== 'Student') return res.redirect('/');
    await User.findByIdAndUpdate(req.session.user.id, { 'financials.outstandingBalance': 0 });
    res.redirect('/financial');
});

app.post('/financial/add-card', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== 'Student') return res.redirect('/');
    
    // DevOps Security: Never save full card details. Mask all but the last 4 digits.
    const rawCard = req.body.cardNumber.replace(/\s/g, '');
    const lastFour = rawCard.slice(-4);
    const maskedCard = `**** **** **** ${lastFour}`;
    
    const newPaymentMethod = {
        type: req.body.cardType,
        maskedNumber: maskedCard,
        brand: "VISA / Mastercard"
    };

    await User.findByIdAndUpdate(req.session.user.id, {
        $push: { 'financials.paymentMethods': newPaymentMethod }
    });

    res.redirect('/financial');
});

app.post('/financial/remove-card', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== 'Student') return res.redirect('/');
    
    await User.findByIdAndUpdate(req.session.user.id, {
        $pull: { 'financials.paymentMethods': { maskedNumber: req.body.maskedNumber } }
    });
    
    res.redirect('/financial');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running successfully on http://localhost:${PORT}`);
});