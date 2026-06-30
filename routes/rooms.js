const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const Booking = require('../models/Booking');

// ─── Helpers ───────────────────────────────────────────────────────────────

// Generates hourly time slots from 08:00 to 21:00
function generateTimeSlots() {
  const slots = [];
  for (let h = 8; h <= 21; h++) {
    const start = `${String(h).padStart(2, '0')}:00`;
    const end = `${String(h + 1).padStart(2, '0')}:00`;
    slots.push({ start, end, label: `${start} - ${end}` });
  }
  return slots;
}

// Returns today's date as YYYY-MM-DD string
function todayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /rooms/seed — populate the DB with sample rooms (dev helper)
router.get('/seed', async (req, res) => {
  try {
    await Room.deleteMany({});
    await Room.insertMany([
      {
        name: 'Discussion Room A',
        description: 'A quiet room ideal for small group discussions and project work.',
        capacity: 6,
        amenities: ['Whiteboard', 'TV Screen', 'WiFi']
      },
      {
        name: 'Discussion Room B',
        description: 'Spacious room with a large table for bigger group sessions.',
        capacity: 10,
        amenities: ['Whiteboard', 'Projector', 'WiFi']
      },
      {
        name: 'Seminar Room 1',
        description: 'Lecture-style room suitable for presentations and seminars.',
        capacity: 30,
        amenities: ['Projector', 'Microphone', 'WiFi', 'Air-con']
      },
      {
        name: 'Quiet Study Pod',
        description: 'A compact, sound-insulated pod for focused individual or pair study.',
        capacity: 2,
        amenities: ['WiFi', 'Power Outlets']
      },
      {
        name: 'Collaboration Hub',
        description: 'Open-plan space with moveable furniture for creative team work.',
        capacity: 20,
        amenities: ['Whiteboards', 'TV Screen', 'WiFi', 'Air-con']
      }
    ]);
    req.flash('success', 'Sample rooms seeded successfully!');
    res.redirect('/rooms');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to seed rooms.');
    res.redirect('/rooms');
  }
});

// GET /rooms — list all rooms
router.get('/', async (req, res) => {
  try {
    const today = req.query.date || todayString();
    const rooms = await Room.find({});
    res.render('rooms/R-index', { rooms, today });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load rooms.');
    res.redirect('/');
  }
});

// DELETE /rooms/bookings/:bookingId — cancel a booking
router.delete('/bookings/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.bookingId);
    if (!booking) {
      req.flash('error', 'Booking not found.');
      return res.redirect('/rooms');
    }

    const dateStr = booking.date.toISOString().split('T')[0];
    req.flash('success', 'Booking cancelled successfully.');
    res.redirect(`/rooms/${booking.room}?date=${dateStr}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not cancel booking.');
    res.redirect('/rooms');
  }
});


// GET /rooms/:id — show a single room with availability slots
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      req.flash('error', 'Room not found.');
      return res.redirect('/rooms');
    }

    const selectedDate = req.query.date || todayString();
    const timeSlots = generateTimeSlots();

    // Find all bookings for this room on the selected date
    const startOfDay = new Date(selectedDate + 'T00:00:00');
    const endOfDay = new Date(selectedDate + 'T23:59:59');
    const bookings = await Booking.find({
      room: room._id,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ startTime: 1 });

    // Expand each booking into every hour it occupies so the slot grid
    // marks all covered hours as unavailable, not just the start hour.
    // e.g. a 09:00–11:00 booking blocks both "09:00" and "10:00".
    const bookedSlots = [];
    for (const b of bookings) {
      let h = parseInt(b.startTime.split(':')[0]);
      const endH = parseInt(b.endTime.split(':')[0]);
      while (h < endH) {
        bookedSlots.push(`${String(h).padStart(2, '0')}:00`);
        h++;
      }
    }

    res.render('rooms/show', { room, timeSlots, bookedSlots, bookings, selectedDate });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load room details.');
    res.redirect('/rooms');
  }
});

// GET /rooms/:id/book — show booking form
router.get('/:id/book', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      req.flash('error', 'Room not found.');
      return res.redirect('/rooms');
    }

    const selectedDate = req.query.date || todayString();
    const selectedStart = req.query.start || '08:00';
    const timeSlots = generateTimeSlots();

    // Compute booked hours for this date so the form can grey them out
    const startOfDay = new Date(selectedDate + 'T00:00:00');
    const endOfDay   = new Date(selectedDate + 'T23:59:59');
    const existingBookings = await Booking.find({
      room: room._id,
      date: { $gte: startOfDay, $lte: endOfDay }
    });
    const bookedSlots = [];
    for (const b of existingBookings) {
      let h = parseInt(b.startTime.split(':')[0]);
      const endH = parseInt(b.endTime.split(':')[0]);
      while (h < endH) {
        bookedSlots.push(`${String(h).padStart(2, '0')}:00`);
        h++;
      }
    }

    res.render('rooms/book', { room, timeSlots, bookedSlots, selectedDate, selectedStart });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load booking form.');
    res.redirect('/rooms');
  }
});

// POST /rooms/:id/book — create a new booking
router.post('/:id/book', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      req.flash('error', 'Room not found.');
      return res.redirect('/rooms');
    }

    const { studentName, studentId, groupSize, purpose, date, startTime, endTime } = req.body;

    // Validate start < end
    if (startTime >= endTime) {
      req.flash('error', 'End time must be after start time.');
      return res.redirect(`/rooms/${room._id}/book?date=${date}&start=${startTime}`);
    }

    // Validate group size does not exceed room capacity
    if (parseInt(groupSize) > room.capacity) {
      req.flash('error', `Group size exceeds room capacity of ${room.capacity}.`);
      return res.redirect(`/rooms/${room._id}/book?date=${date}&start=${startTime}`);
    }

    // Check for conflicts: any existing booking whose time range overlaps
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59');
    const existing = await Booking.find({
      room: room._id,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    const hasConflict = existing.some(booking => {
      return startTime < booking.endTime && endTime > booking.startTime;
    });

    if (hasConflict) {
      req.flash('error', 'That time slot conflicts with an existing booking. Please choose another time.');
      return res.redirect(`/rooms/${room._id}?date=${date}`);
    }

    await Booking.create({
      room: room._id,
      studentName,
      studentId,
      groupSize: parseInt(groupSize),
      purpose,
      date: new Date(date + 'T00:00:00'),
      startTime,
      endTime
    });

    req.flash('success', `Room booked successfully for ${date} from ${startTime} to ${endTime}!`);
    res.redirect(`/rooms/${room._id}?date=${date}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Booking failed. Please try again.');
    res.redirect('/rooms');
  }
});

// GET /rooms/:id/bookings — view all bookings for a room
router.get('/:id/bookings', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      req.flash('error', 'Room not found.');
      return res.redirect('/rooms');
    }

    const bookings = await Booking.find({ room: room._id }).sort({ date: 1, startTime: 1 });
    res.render('rooms/bookings', { room, bookings });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load bookings.');
    res.redirect('/rooms');
  }
});

module.exports = router;