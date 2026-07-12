const crypto = require('crypto');
const bcrypt = require('bcrypt');
const session = require('express-session');
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

const User = require('./models/User');
const Question = require('./models/Question');
const Notification = require('./models/Notification');
const app = express();
const PORT = process.env.PORT || 8080;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSIONSECRET || 'campus-portal-secret',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSIONSECRET || 'campus-portal-secret',
  resave: false,
  saveUninitialized: false
}));


const academicModules = {
  "School of Infocomm": [
    "OS",
    "Cloud Computing",
    "Software Application Development",
    "DevOps Essentials",
    "Intelligent Networks",
    "Linux Administration"
  ],
  "School of Business": [
    "Business Analytics",
    "Financial Accounting",
    "Marketing",
    "Business Law"
  ],
  "School of Engineering": [
    "Engineering Mathematics",
    "Electronics",
    "CAD",
    "Programming for Engineers"
  ],
  "School of Hospitality": [
    "Hospitality Operations",
    "Tourism",
    "Food & Beverage Management"
  ]
};

const generalTopics = [
  "Timetable",
  "WiFi",
  "Library",
  "Student Services",
  "Facilities",
  "Internship",
  "Scholarships",
  "Others"
];

function normalizeId(id) {
  return (id || '').trim().toUpperCase();
}

function isOwner(req, ownerId) {
  return req.session.user && ownerId && String(ownerId) === String(req.session.user.id);
}

function requireLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'Admin') return next();
  return res.status(403).send('Forbidden: Admins Only');
}

function getRelativeTime(dateString) {
  const now = new Date();
  const postedDate = new Date(dateString);
  const diffMs = now - postedDate;
  const minute = 1000 * 60;
  const hour = minute * 60;
  const day = hour * 24;

  if (diffMs < minute) return 'Posted Just Now';
  if (diffMs < hour) {
    const mins = Math.floor(diffMs / minute);
    return `Posted ${mins} min${mins > 1 ? 's' : ''} ago`;
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `Posted ${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (diffMs < day * 2) return 'Posted Yesterday';

  const days = Math.floor(diffMs / day);
  return `Posted ${days} days ago`;
}

function prepareQuestionsWithTime(data) {
  return data.map(question => ({
    ...question.toObject(),
    relativeTime: getRelativeTime(question.createdAt),
    replies: question.replies.map(reply => ({
      ...reply.toObject(),
      relativeTime: getRelativeTime(reply.createdAt)
    }))
  }));
}

async function getForumStats() {
  const totalQuestions = await Question.countDocuments();
  const totalRepliesAgg = await Question.aggregate([
    { $project: { replyCount: { $size: '$replies' } } },
    { $group: { _id: null, total: { $sum: '$replyCount' } } }
  ]);
  const totalModules = await Question.distinct('module');

  return {
    totalQuestions,
    totalReplies: totalRepliesAgg[0]?.total || 0,
    totalModules: totalModules.length
  };
}

app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.academicModules = academicModules;
  res.locals.generalTopics = generalTopics;

  try {
    if (req.session.user?.id) {
      const liveUser = await User.findById(req.session.user.id).select('themePreference role fullName campusId');
      if (liveUser) {
        req.session.user.role = liveUser.role;
        req.session.user.fullName = liveUser.fullName;
        req.session.user.campusId = liveUser.campusId;
        req.session.user.themePreference = liveUser.themePreference || 'light';
        res.locals.themePreference = liveUser.themePreference || 'light';
      } else {
        res.locals.themePreference = 'light';
      }
    } else {
      res.locals.themePreference = 'light';
    }
    } catch (e) {
    res.locals.themePreference = req.session.user?.themePreference || 'light';
  }

  next();
});

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
        
        // 1. Fetch your notifications from MongoDB (sorted latest first)
        const notifications = await mongoose.connection.db.collection('events').find().toArray();

        // 2. Pass notifications to the EJS template alongside the user profile
        res.render('index', { 
            profile: user, 
            notifications: notifications 
        });
    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).send('Internal Server Error');
    }
});
// Route to view a specific event's full details
app.get('/events/:id', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    try {
        const { ObjectId } = require('mongodb');
        const eventId = req.params.id;

        // Fetch the specific event matching the clicked ID directly from the events collection
        const event = await mongoose.connection.db.collection('events').findOne({ _id: new ObjectId(eventId) });

        if (!event) {
            return res.status(404).send('Event not found');
        }

        // Render a detail view page and pass the event data to it
        res.render('event-detail', { 
            profile: req.session.user, 
            event: event 
        });
    } catch (err) {
        console.error('Error fetching event details:', err);
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

app.get('/', requireLogin, async (req, res) => {
  try {
    const profile = await User.findById(req.session.user.id);
    res.render('index', { profile });
  } catch (err) {
    console.error('Dashboard Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { resetSuccess: req.query.reset || '', error: '' });
});

app.post('/login', async (req, res) => {
  try {
    const { campusId, password } = req.body;
    const user = await User.findOne({ campusId: normalizeId(campusId) });

    if (!user || !user.password) {
      return res.status(400).render('login', { error: 'Invalid campus ID or password', resetSuccess: '' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).render('login', { error: 'Invalid campus ID or password', resetSuccess: '' });
    }

    req.session.user = {
      id: user._id.toString(),
      fullName: user.fullName,
      campusId: user.campusId,
      role: user.role,
      themePreference: user.themePreference || 'light'
    };

    res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('register', {
    error: '',
    fullName: '',
    campusId: '',
    role: '',
    securityQuestion: '',
    securityAnswer: ''
  });
});

app.post('/register', async (req, res) => {
  try {
    const { fullName, campusId, password, confirmPassword, securityQuestion, securityAnswer, role } = req.body;
    const cleanId = normalizeId(campusId);
    const cleanName = (fullName || '').trim();

    if (password !== confirmPassword) {
      return res.render('register', { error: 'Passwords do not match.', fullName, campusId, role, securityQuestion, securityAnswer });
    }

    if (role === 'Student' && cleanId.startsWith('E')) {
      return res.render('register', { error: 'Role mismatch: E IDs are reserved for Staff.', fullName, campusId, role, securityQuestion, securityAnswer });
    }

    if (role === 'Admin' && cleanId.startsWith('S')) {
      return res.render('register', { error: 'Role mismatch: S IDs are reserved for Students.', fullName, campusId, role, securityQuestion, securityAnswer });
    }

    const alreadyActive = await User.findOne({ campusId: cleanId, isRegistered: true });
    if (alreadyActive) {
      return res.render('register', { error: 'This Campus ID has already been registered and activated.', fullName, campusId, role, securityQuestion, securityAnswer });
    }

    const whitelistUser = await User.findOne({
      campusId: cleanId,
      fullName: cleanName,
      role,
      isRegistered: false
    });

    if (!whitelistUser) {
      return res.render('register', { error: 'Identity verification failed. Your ID and name do not match our campus directory enrollment logs.', fullName, campusId, role, securityQuestion, securityAnswer });
    }

    const salt = await bcrypt.genSalt(10);
    whitelistUser.password = await bcrypt.hash(password, salt);
    whitelistUser.securityQuestion = securityQuestion;
    whitelistUser.securityAnswer = securityAnswer;
    whitelistUser.recoveryKey = 'CP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    whitelistUser.isRegistered = true;

    await whitelistUser.save();
    res.redirect('/login');
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).send('Server Error during registration');
  }
});

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});

app.post('/forgot-password', async (req, res) => {
  try {
    const { campusId, recoveryMethod, recoveryKey, securityAnswer } = req.body;
    let user = null;

    const cleanId = normalizeId(campusId);
    const cleanKey = (recoveryKey || '').trim().toUpperCase();
    const cleanAnswer = (securityAnswer || '').trim().toLowerCase();

    if (recoveryMethod === 'key') {
      user = await User.findOne({ campusId: cleanId, recoveryKey: cleanKey });
    } else if (recoveryMethod === 'question') {
      user = await User.findOne({ campusId: cleanId });
      if (user && (user.securityAnswer || '').trim().toLowerCase() !== cleanAnswer) {
        user = null;
      }
    } else {
      user = await User.findOne({
        campusId: cleanId,
        $or: [
          { recoveryKey: cleanKey },
          { securityAnswer: cleanAnswer }
        ]
      });
    }

    if (user) {
      req.session.resetUserId = user._id.toString();
      return res.redirect('/reset-password');
    }

    res.status(401).send('Invalid ID or Recovery Information.');
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/reset-password', (req, res) => {
  if (!req.session.resetUserId) return res.redirect('/login');
  res.render('reset-password');
});

app.post('/reset-password', async (req, res) => {
  try {
    if (!req.session.resetUserId) return res.redirect('/login');

    const { newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) {
      return res.status(400).send('Passwords do not match');
    }

    const user = await User.findById(req.session.resetUserId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    req.session.resetUserId = null;
    res.redirect('/login?reset=success');
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/profile', requireLogin, async (req, res) => {
  try {
    const userProfile = await User.findById(req.session.user.id);
    if (!userProfile) {
      req.session.destroy(() => {});
      return res.redirect('/login');
    }
    res.render('profile', { userProfile });
  } catch (err) {
    console.error('Profile Fetch Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/profile/regenerate-key', requireLogin, async (req, res) => {
  try {
    const newKey = 'CP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    await User.findByIdAndUpdate(req.session.user.id, { recoveryKey: newKey });
    res.redirect('/profile');
  } catch (err) {
    console.error('Regenerate Key Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/profile/theme', requireLogin, async (req, res) => {
  try {
    const safeTheme = req.body.themePreference === 'dark' ? 'dark' : 'light';
    await User.findByIdAndUpdate(req.session.user.id, { themePreference: safeTheme });
    req.session.user.themePreference = safeTheme;
    res.redirect('/profile');
  } catch (err) {
    console.error('Theme Update Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/admin/helpdesk', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({});
    res.render('admin-helpdesk', { users });
  } catch (err) {
    console.error('Admin Fetch Users Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/admin/reset-user', requireAdmin, async (req, res) => {
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

app.get('/forum', requireLogin, async (req, res) => {
  try {
    const questions = await Question.find().sort({ createdAt: -1 });
    const stats = await getForumStats();
    const preparedQuestions = prepareQuestionsWithTime(questions);
    const isAdmin = req.session.user.role === 'Admin';

    res.render('forum', {
    questions: preparedQuestions,
    totalQuestions: stats.totalQuestions,
    totalReplies: stats.totalReplies,
    totalModules: stats.totalModules,

    success: req.query.success || '',
    error: req.query.error || '',

    user: req.session.user,

    academicModules,
    generalTopics,

    isAdmin,
    editReply: null
});

  } catch (err) {
    console.error('Forum load error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum', requireLogin, async (req, res) => {
  try {
    const { category, school, module, enquiryTopic, title, description } = req.body;

    const payload = {
      category: category.trim(),
      title: title.trim(),
      description: description.trim(),
      userId: req.session.user.id,
      fullName: req.session.user.fullName,
      campusId: req.session.user.campusId
    };

    if (category === 'Academic Modules') {
      payload.school = (school || '').trim();
      payload.module = (module || '').trim();
    } else {
      payload.enquiryTopic = (enquiryTopic || '').trim();
      payload.module = (enquiryTopic || '').trim();
    }

    await Question.create(payload);
    res.redirect('/forum?success=Question%20posted%20successfully');
  } catch (err) {
    console.error('Add question error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/reply/:id', requireLogin, async (req, res) => {
  try {
    const { reply } = req.body;
    const questionId = req.params.id;

    if (reply.trim() !== '') {
      await Question.findByIdAndUpdate(questionId, {
        $push: {
          replies: {
            userId: req.session.user.id,
            fullName: req.session.user.fullName,
            campusId: req.session.user.campusId,
            text: reply.trim(),
            helpful: 0,
            helpfulBy: []
          }
        }
      });
    }

    res.redirect('/forum?success=Reply%20posted%20successfully');
  } catch (err) {
    console.error('Reply error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/forum/reply/edit/:questionId/:replyIndex', requireLogin, async (req, res) => {
  try {
    const { questionId, replyIndex } = req.params;
    const question = await Question.findById(questionId);
    if (!question || !question.replies[replyIndex]) return res.redirect('/forum');

    const reply = question.replies[replyIndex];
    const isAdmin = req.session.user.role === 'Admin';
    if (!isAdmin && !isOwner(req, reply.userId)) return res.status(403).send('Forbidden');

    const questions = await Question.find().sort({ createdAt: -1 });
    const stats = await getForumStats();
    const preparedQuestions = prepareQuestionsWithTime(questions);

    res.render('forum', {
      questions: preparedQuestions,
      totalQuestions: stats.totalQuestions,
      totalReplies: stats.totalReplies,
      totalModules: stats.totalModules,
      success: '',
      isAdmin,
      editReply: { questionId, replyIndex: Number(replyIndex), text: reply.text }
    });
  } catch (err) {
    console.error('Edit reply page error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/reply/edit/:questionId/:replyIndex', requireLogin, async (req, res) => {
  try {
    const { questionId, replyIndex } = req.params;
    const { replyText } = req.body;
    const question = await Question.findById(questionId);
    if (!question || !question.replies[replyIndex]) return res.redirect('/forum');

    const reply = question.replies[replyIndex];
    const isAdmin = req.session.user.role === 'Admin';
    if (!isAdmin && !isOwner(req, reply.userId)) return res.status(403).send('Forbidden');

    question.replies[replyIndex].text = replyText.trim();
    await question.save();

    res.redirect('/forum?success=Reply%20updated%20successfully');
  } catch (err) {
    console.error('Edit reply error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/reply/delete/:questionId/:replyIndex', requireLogin, async (req, res) => {
  try {
    const { questionId, replyIndex } = req.params;
    const question = await Question.findById(questionId);
    if (!question || !question.replies[replyIndex]) return res.redirect('/forum');

    const reply = question.replies[replyIndex];
    const isAdmin = req.session.user.role === 'Admin';
    if (!isAdmin && !isOwner(req, reply.userId)) return res.status(403).send('Forbidden');

    question.replies.splice(Number(replyIndex), 1);
    await question.save();

    res.redirect('/forum?success=Reply%20deleted%20successfully');
  } catch (err) {
    console.error('Delete reply error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/reply/helpful/:questionId/:replyIndex', requireLogin, async (req, res) => {
  try {
    const { questionId, replyIndex } = req.params;
    const question = await Question.findById(questionId);
    if (!question || !question.replies[replyIndex]) return res.redirect('/forum');

    const reply = question.replies[replyIndex];
    const uid = String(req.session.user.id);
    const ownerId = String(reply.userId);

    if (uid === ownerId) {
      return res.redirect('/forum?error=cannot-help-own-reply');
    }

    reply.helpfulBy = Array.isArray(reply.helpfulBy) ? reply.helpfulBy : [];

    if (reply.helpfulBy.includes(uid)) {
      reply.helpfulBy = reply.helpfulBy.filter(id => id !== uid);
    } else {
      reply.helpfulBy.push(uid);
    }

    reply.helpful = reply.helpfulBy.length;
    await question.save();

    res.redirect('/forum?success=helpful-updated');
  } catch (err) {
    console.error('Helpful toggle error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/solved/:id', requireLogin, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.redirect('/forum');

    const isAdmin = req.session.user.role === 'Admin';
    if (!isAdmin && !isOwner(req, question.userId)) {
      return res.status(403).send('Forbidden');
    }

    await Question.findByIdAndUpdate(req.params.id, { solved: true });
    res.redirect('/forum?success=Question%20marked%20as%20solved');
  } catch (err) {
    console.error('Solved error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/delete/:id', requireLogin, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.redirect('/forum');

    if (req.session.user.role !== 'Admin' && !isOwner(req, question.userId)) {
      return res.status(403).send('Forbidden');
    }

    await Question.findByIdAndDelete(req.params.id);
    res.redirect('/forum?success=Question%20deleted%20successfully');
  } catch (err) {
    console.error('Delete question error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/forum/edit/:id', requireLogin, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.redirect('/forum');

    const isAdmin = req.session.user.role === 'Admin';
    if (!isAdmin && !isOwner(req, question.userId)) {
      return res.status(403).send('Forbidden');
    }

    res.render('edit', { question });
  } catch (err) {
    console.error('Edit page error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/edit/:id', requireLogin, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.redirect('/forum');

    const isAdmin = req.session.user.role === 'Admin';
    if (!isAdmin && !isOwner(req, question.userId)) {
      return res.status(403).send('Forbidden');
    }

    const { category, school, module, enquiryTopic, title, description } = req.body;
    const update = {
      category: category.trim(),
      title: title.trim(),
      description: description.trim()
    };

    if (category === 'Academic Modules') {
      update.school = (school || '').trim();
      update.module = (module || '').trim();
      update.enquiryTopic = '';
    } else {
      update.school = '';
      update.enquiryTopic = (enquiryTopic || '').trim();
      update.module = (enquiryTopic || '').trim();
    }

    await Question.findByIdAndUpdate(req.params.id, update);
    res.redirect('/forum?success=Question%20updated%20successfully');
  } catch (err) {
    console.error('Update question error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/reply/:id', requireLogin, async (req, res) => {
  try {
    const { reply } = req.body;
    const questionId = req.params.id;

    if (reply.trim() !== '') {
      await Question.findByIdAndUpdate(questionId, {
        $push: {
          replies: {
            userId: req.session.user.id,
            fullName: req.session.user.fullName,
            campusId: req.session.user.campusId,
            text: reply.trim(),
            helpful: 0,
            helpfulBy: []
          }
        }
      });
    }

    res.redirect('/forum?success=reply-posted');
  } catch (err) {
    console.error('Reply error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/forum/reply/edit/:questionId/:replyIndex', requireLogin, async (req, res) => {
  try {
    const { questionId, replyIndex } = req.params;
    const question = await Question.findById(questionId);
    if (!question || !question.replies[replyIndex]) return res.redirect('/forum');

    const reply = question.replies[replyIndex];
    const isAdmin = req.session.user.role === 'Admin';
    if (!isAdmin && !isOwner(req, reply.userId)) return res.status(403).send('Forbidden');

    const questions = await Question.find().sort({ createdAt: -1 });
    const stats = await getForumStats();
    const preparedQuestions = prepareQuestionsWithTime(questions);

    res.render('forum', {
      questions: preparedQuestions,
      totalQuestions: stats.totalQuestions,
      totalReplies: stats.totalReplies,
      totalModules: stats.totalModules,
      success: '',
      isAdmin,
      editReply: { questionId, replyIndex: Number(replyIndex), text: reply.text }
    });
  } catch (err) {
    console.error('Edit reply page error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/reply/edit/:questionId/:replyIndex', requireLogin, async (req, res) => {
  try {
    const { questionId, replyIndex } = req.params;
    const { replyText } = req.body;
    const question = await Question.findById(questionId);
    if (!question || !question.replies[replyIndex]) return res.redirect('/forum');

    const reply = question.replies[replyIndex];
    const isAdmin = req.session.user.role === 'Admin';
    if (!isAdmin && !isOwner(req, reply.userId)) return res.status(403).send('Forbidden');

    question.replies[replyIndex].text = replyText.trim();
    await question.save();

    res.redirect('/forum?success=reply-updated');
  } catch (err) {
    console.error('Edit reply error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/reply/delete/:questionId/:replyIndex', requireLogin, async (req, res) => {
  try {
    const { questionId, replyIndex } = req.params;
    const question = await Question.findById(questionId);
    if (!question || !question.replies[replyIndex]) return res.redirect('/forum');

    const reply = question.replies[replyIndex];
    const isAdmin = req.session.user.role === 'Admin';
    if (!isAdmin && !isOwner(req, reply.userId)) return res.status(403).send('Forbidden');

    question.replies.splice(Number(replyIndex), 1);
    await question.save();

    res.redirect('/forum?success=reply-deleted');
  } catch (err) {
    console.error('Delete reply error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/reply/helpful/:questionId/:replyIndex', requireLogin, async (req, res) => {
  try {
    const { questionId, replyIndex } = req.params;
    const question = await Question.findById(questionId);

    if (!question || !question.replies[replyIndex]) return res.redirect('/forum');

    const uid = req.session.user.id;

    const reply = question.replies[replyIndex];
    reply.helpfulBy = Array.isArray(reply.helpfulBy) ? reply.helpfulBy : [];

    if (reply.helpfulBy.includes(uid)) {
      reply.helpfulBy = reply.helpfulBy.filter(id => id !== uid);
    } else {
      reply.helpfulBy.push(uid);
    }

    reply.helpful = reply.helpfulBy.length;

    await Question.updateOne(
      { _id: questionId },
      {
        $set: {
          [`replies.${replyIndex}.helpfulBy`]: reply.helpfulBy,
          [`replies.${replyIndex}.helpful`]: reply.helpful
        }
      }
    );

    res.redirect('/forum');
  } catch (err) {
    console.error('Helpful toggle error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/solved/:id', requireAdmin, async (req, res) => {
  try {
    await Question.findByIdAndUpdate(req.params.id, { solved: true });
    res.redirect('/forum');
  } catch (err) {
    console.error('Solved error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/delete/:id', requireLogin, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.redirect('/forum');

    if (req.session.user.role !== 'Admin' && !isOwner(req, question.userId)) {
      return res.status(403).send('Forbidden');
    }

    await Question.findByIdAndDelete(req.params.id);
    res.redirect('/forum?success=Question%20deleted%20successfully');
  } catch (err) {
    console.error('Delete question error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/forum/edit/:id', requireAdmin, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.redirect('/forum');
    res.render('edit', { question });
  } catch (err) {
    console.error('Edit page error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/forum/edit/:id', requireAdmin, async (req, res) => {
  try {
    const { category, school, module, enquiryTopic, title, description } = req.body;
    const update = {
      category: category.trim(),
      title: title.trim(),
      description: description.trim()
    };

    if (category === 'Academic Modules') {
      update.school = (school || '').trim();
      update.module = (module || '').trim();
      update.enquiryTopic = '';
    } else {
      update.school = '';
      update.enquiryTopic = (enquiryTopic || '').trim();
      update.module = (enquiryTopic || '').trim();
    }

    await Question.findByIdAndUpdate(req.params.id, update);
    res.redirect('/forum?success=question-updated');
  } catch (err) {
    console.error('Update question error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

mongoose.connect(process.env.MONGO_URI, { family: 4 })
  .then(() => {
    console.log('MongoDB Connected Successfully to CampusPortal!');
    app.listen(PORT, () => {
      console.log(`Server is running successfully on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB Connection Error:', err);
  });