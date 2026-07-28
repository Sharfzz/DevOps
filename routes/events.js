const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// GET: Display all campus events page
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.render('events', { events });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error fetching events');
  }
});

// POST: Add a new campus event
router.post('/add', async (req, res) => {
  try {
    const { title, description, date, location, organizer, eventType, priority, isPinned } = req.body;
    
    await Event.create({
      title,
      description,
      date,
      location,
      organizer,
      eventType,
      priority,
      isPinned: isPinned === 'on'
    });

    res.redirect('/events');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating event');
  }
});

// ================= NUMBER 2 STARTS HERE =================
// GET: API endpoint for homepage widget to fetch events
router.get('/api/list', async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 }).limit(3);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});
// ========================================================

module.exports = router;