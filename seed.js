const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// Distinct sets of completely fake mock datasets
const fakeAddresses = [
    "Blk 456 Jurong West Street 42 #08-123 S(640456)",
    "Blk 789 Ang Mo Kio Avenue 3 #12-456 S(560789)",
    "Blk 234 Pasir Ris Drive 4 #02-89 S(510234)",
    "Blk 512 Yishun Ring Road #10-512 S(760512)",
    "Blk 678 Woodlands Avenue 6 #05-221 S(730678)",
    "Blk 301 Tampines Street 32 #11-04 S(520301)",
    "Blk 890 Lorong 1 Toa Payoh #06-78 S(310890)",
    "Blk 123 Clementi Avenue 3 #09-99 S(120123)",
    "Blk 555 Fajar Road #07-12 S(670555)",
    "Blk 441 Bedok North Avenue 3 #04-56 S(460441)"
];

const fakeHomeNumbers = ["62514321", "63457890", "67891234", "64567890", "68901234", "65554321", "62223333", "63334444", "64445555", "67778888"];
const fakeMobileNumbers = ["81234567", "82345678", "83456789", "84567890", "85678901", "91234567", "92345678", "93456789", "94567890", "95678901"];
const fakeDobs = ["12 Jan 2005", "23 Mar 2005", "15 Jun 2005", "30 Dec 2005", "08 Aug 2005", "14 Feb 1995", "19 Jul 1993", "02 Oct 1990", "25 Nov 1988", "05 May 1992"];
const fakeNationalities = ["SINGAPOREAN", "SINGAPOREAN", "SINGAPORE PR", "SINGAPOREAN", "SINGAPOREAN", "SINGAPOREAN", "SINGAPORE PR", "SINGAPOREAN", "SINGAPOREAN", "SINGAPOREAN"];

const baseUsers = [
    { campusId: 'S0000001', fullName: 'Amy', role: 'Student' },
    { campusId: 'S0000002', fullName: 'Bob', role: 'Student' },
    { campusId: 'S0000003', fullName: 'Cam', role: 'Student' },
    { campusId: 'S0000004', fullName: 'Dan', role: 'Student' },
    { campusId: 'S0000005', fullName: 'Eve', role: 'Student' },
    { campusId: 'E0000001', fullName: 'Tom', role: 'Admin' },
    { campusId: 'E0000002', fullName: 'Sam', role: 'Admin' },
    { campusId: 'E0000003', fullName: 'Ray', role: 'Admin' },
    { campusId: 'E0000004', fullName: 'Mia', role: 'Admin' },
    { campusId: 'E0000005', fullName: 'Zoe', role: 'Admin' }
];

// Map across the baseline users to inject dynamic, uniquely indexed attributes
const seedData = baseUsers.map((user, index) => {
    let assignedCourse = "N/A";
    let assignedSchool = "Administration";

    if (user.role === 'Student') {
        if (user.fullName === 'Dan') {
            assignedCourse = "Diploma in Enterprise Cloud Computing & Management";
            assignedSchool = "School of Infocomm";
        } else if (user.fullName === 'Amy') {
            assignedCourse = "Diploma in Cybersecurity & Digital Forensics";
            assignedSchool = "School of Infocomm";
        } else if (user.fullName === 'Bob') {
            assignedCourse = "Diploma in Business Administration";
            assignedSchool = "School of Business";
        } else if (user.fullName === 'Cam') {
            assignedCourse = "Diploma in Data Science & Analytics";
            assignedSchool = "School of Applied Science";
        } else if (user.fullName === 'Eve') {
            assignedCourse = "Diploma in Software Engineering";
            assignedSchool = "School of Computing";
        }
    }

    return {
        ...user,
        isRegistered: false,
        campusEmail: `${user.campusId.toLowerCase()}@school.edu.sg`,
        personalEmail: `${user.fullName.toLowerCase()}30@gmail.com`,
        course: assignedCourse,
        school: assignedSchool,
        contactHome: fakeHomeNumbers[index],
        contactMobile: fakeMobileNumbers[index],
        address: fakeAddresses[index],
        dob: fakeDobs[index],
        sex: index % 2 === 0 ? "Female" : "Male",
        nationality: fakeNationalities[index],
        financials: {
            outstandingBalance: user.role === 'Student' ? 1450.00 : 0.00,
            dueDate: user.role === 'Student' ? "15 Aug 2026" : "N/A",
            paymentMethods: []
        }
    };
});

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { family: 4 });
        console.log('Connected to MongoDB for seeding.');

        await User.deleteMany({});
        console.log('Cleared existing database records.');

        await User.insertMany(seedData);
        console.log('Successfully seeded 10 highly distinct, randomized user records.');

        mongoose.connection.close();
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
}

seedDatabase();
