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
        name: 'Study Room 1',
        description: 'Quiet room perfect for individual revision or focused study sessions.',
        capacity: 4,
        layout: 'Standard Desks',
        amenities: ['Power Outlets', 'WiFi', 'Desk Lamps']
      },
      {
        name: 'Project Room A',
        description: 'Collaborative space for group projects with whiteboards.',
        capacity: 8,
        layout: 'Group Tables',
        amenities: ['Whiteboard', 'WiFi', 'TV Screen']
      },
      {
        name: 'Presentation Room',
        description: 'Equipped room to practice presentations with a projector.',
        capacity: 12,
        layout: 'Boardroom',
        amenities: ['Projector', 'Whiteboard', 'WiFi']
      },
      {
        name: 'Revision Pod',
        description: 'Small pod for focused revision.',
        capacity: 2,
        layout: 'Compact Pod',
        amenities: ['Power Outlets', 'WiFi']
      },
      {
        name: 'Club Meeting Room',
        description: 'Spacious room for Club and CCA meetings.',
        capacity: 20,
        layout: 'U-Shape',
        amenities: ['Projector', 'Microphone', 'Whiteboards', 'WiFi']
      },
      {
        name: 'Multi-Purpose Room',
        description: 'Versatile room for other miscellaneous activities.',
        capacity: 15,
        layout: 'Flexible Seating',
        amenities: ['Moveable Whiteboards', 'TV Screen', 'WiFi']
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

// GET /rooms/my-bookings — display user's booking history
router.get('/my-bookings', async (req, res) => {
  try {
    const bookings = await Booking.find({ studentId: req.session.user.campusId })
      .populate('room')
      .sort({ date: 1, startTime: 1 });
    res.render('rooms/my-bookings', { bookings });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load your bookings.');
    res.redirect('/rooms');
  }
});

// GET /rooms — list all rooms
router.get('/', async (req, res) => {
  try {
    const today = req.query.date || todayString();
    let rooms = await Room.find({}).lean();
    
    const timeSlots = generateTimeSlots();
    const startOfDay = new Date(today + 'T00:00:00');
    const endOfDay = new Date(today + 'T23:59:59');
    
    const allBookings = await Booking.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    const now = new Date();

    rooms = rooms.map(room => {
      const roomBookings = allBookings.filter(b => b.room.toString() === room._id.toString());
      
      const bookedHours = [];
      roomBookings.forEach(b => {
        let h = parseInt(b.startTime.split(':')[0]);
        const endH = parseInt(b.endTime.split(':')[0]);
        while (h < endH) {
          bookedHours.push(`${String(h).padStart(2, '0')}:00`);
          h++;
        }
      });

      let availableSlots = 0;
      timeSlots.forEach(slot => {
        const isBooked = bookedHours.includes(slot.start);
        
        const slotDate = new Date(today);
        const [hours, minutes] = slot.start.split(':').map(Number);
        slotDate.setHours(hours, minutes, 0, 0);
        const isPassed = now > slotDate;

        if (!isBooked && !isPassed) {
          availableSlots++;
        }
      });

      return { ...room, availableSlots };
    });

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
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      req.flash('error', 'Booking not found.');
      return res.redirect('/rooms');
    }

    if (booking.studentId !== req.session.user.campusId) {
      return res.status(403).send('403 Unauthorized');
    }

    await Booking.findByIdAndDelete(req.params.bookingId);

    const dateStr = booking.date.toISOString().split('T')[0];
    req.flash('success', 'Booking cancelled successfully.');
    res.redirect(`/rooms/${booking.room}?date=${dateStr}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not cancel booking.');
    res.redirect('/rooms');
  }
});

// DELETE /rooms/bookings-all — cancel ALL bookings for the logged-in user
router.delete('/bookings-all/user', async (req, res) => {
  try {
    const campusId = req.session.user.campusId;
    if (!campusId) {
      return res.status(401).send('401 Unauthorized');
    }
    await Booking.deleteMany({ studentId: campusId });
    res.status(200).send('All bookings cancelled successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Could not cancel bookings.');
  }
});


// PATCH /rooms/bookings/:bookingId/extend — extend booking by 1 hour
router.patch('/bookings/:bookingId/extend', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (booking.studentId !== req.session.user.campusId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (booking.isExtended === true) {
      return res.status(400).json({ success: false, message: 'You have already used your one-time extension for this session.' });
    }

    const [endH, endM] = booking.endTime.split(':').map(Number);
    const newEndH = endH + 1;
    if (newEndH > 22 || (newEndH === 22 && endM > 0)) {
      return res.status(400).json({ success: false, message: 'Cannot extend past 22:00.' });
    }
    const newEndTime = `${String(newEndH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    // Overlap Check for the new extra hour
    const existingBookings = await Booking.find({
      room: booking.room,
      date: booking.date,
      _id: { $ne: booking._id }
    });
    
    const hasOverlap = existingBookings.some(b => {
       return booking.endTime < b.endTime && newEndTime > b.startTime;
    });

    if (hasOverlap) {
      return res.status(400).json({ success: false, message: 'Cannot extend: The room is already booked for the next hour.' });
    }

    booking.endTime = newEndTime;
    booking.isExtended = true;
    await booking.save();

    res.json({ success: true, newEndTime });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error extending booking' });
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
    const endOfDay = new Date(selectedDate + 'T23:59:59');
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

    // Calculate user quotas
    let roomQuota = 3;
    let globalQuota = 5;
    if (req.session.user) {
      const userExistingBookings = await Booking.find({
        studentId: req.session.user.campusId,
        date: { $gte: startOfDay, $lte: endOfDay }
      });
      const roomBookingsCount = userExistingBookings.filter(b => b.room.toString() === room._id.toString()).length;
      roomQuota = 3 - roomBookingsCount;
      globalQuota = 5 - userExistingBookings.length;
    }

    res.render('rooms/book', { room, timeSlots, bookedSlots, selectedDate, selectedStart, roomQuota, globalQuota });
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

    const { groupSize, purpose, date, startTime, endTime } = req.body;
    const studentName = req.session.user.fullName;
    const studentId = req.session.user.campusId;

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

    const getHours = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h + (m / 60);
    };

    const requestedHours = getHours(endTime) - getHours(startTime);
    let purposeLimit = 2; // Study Session, Revision, Presentation Practice (Study equivalent)
    if (['Group Project', 'Club/CCA Meeting'].includes(purpose)) {
      purposeLimit = 4; // Project, Meeting equivalent
    } else if (purpose === 'Others') {
      purposeLimit = 8; // Event / Seminar equivalent
    }
    // Per-Booking Session Duration Limit
    console.log("Requested Duration:", requestedHours, "Allowed Limit:", purposeLimit);

    if (requestedHours > purposeLimit) {
      req.flash('error', `This booking exceeds the maximum allowed duration of ${purposeLimit} hours for a ${purpose}.`);
      return res.redirect(`/rooms/${room._id}/book?date=${date}&start=${startTime}`);
    }

    // Sequential Booking Hoarding Check
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const futureBookingsForPurpose = await Booking.find({
      studentId: req.session.user.campusId,
      purpose: purpose,
      date: { $gte: todayStart }
    });

    const hasHoardedBooking = futureBookingsForPurpose.some(booking => {
      // Allow advance booking by only blocking if the requested slot chronologically overlaps
      if (new Date(booking.date).getTime() !== startOfDay.getTime()) return false;
      return startTime < booking.endTime && endTime > booking.startTime;
    });

    if (hasHoardedBooking) {
      req.flash('error', `You already have an active booking for ${purpose} during this time slot. Please choose a different time slot!`);
      return res.redirect(`/rooms/${room._id}/book?date=${date}&start=${startTime}`);
    }

    const userExistingBookings = await Booking.find({
      studentId: req.session.user.campusId,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    // Part 1: Per-Room Daily Cap (Max 3)
    const roomBookingsCount = userExistingBookings.filter(b => b.room.toString() === room._id.toString()).length;
    if (roomBookingsCount >= 3) {
      req.flash('error', 'You have reached the maximum limit of 3 bookings per day for this specific room.');
      return res.redirect(`/rooms/${room._id}/book?date=${date}&start=${startTime}`);
    }

    // Part 2: Global Campus-Wide Daily Cap (Max 5)
    if (userExistingBookings.length >= 5) {
      req.flash('error', 'You have reached the global maximum limit of 5 bookings per day across all campus rooms.');
      return res.redirect(`/rooms/${room._id}/book?date=${date}&start=${startTime}`);
    }

    // Prevent Concurrent/Overlapping Bookings for the SAME user
    const userHasConflict = userExistingBookings.some(booking => {
      return startTime < booking.endTime && endTime > booking.startTime;
    });

    if (userHasConflict) {
      req.flash('error', 'You already have a room booked during this time slot.');
      return res.redirect(`/rooms/${room._id}/book?date=${date}&start=${startTime}`);
    }

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