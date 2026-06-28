const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 8080;

const dataFilePath = path.join(__dirname, "questions.json");

// =========================
// Middleware
// =========================
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// =========================
// EJS
// =========================
app.set("view engine", "ejs");

// =========================
// Default Data
// =========================
const defaultQuestions = [
    {
        id: 1,
        module: "c270 devops essentials",
        title: "Git Merge Conflict",
        description: "How do I solve merge conflicts after pulling from GitHub?",
        student: "Student123",
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        solved: false,
        replies: [
            {
                student: "Student456",
                text: "Run git status first to see which files have conflicts.",
                helpful: 0,
                createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
            }
        ]
    },
    {
        id: 2,
        module: "c229 os & cloud computing",
        title: "Python Functions",
        description: "Can someone explain the difference between print() and return?",
        student: "Student789",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        solved: false,
        replies: []
    }
];

// =========================
// File Helpers
// =========================
function ensureDataFile() {
    if (!fs.existsSync(dataFilePath)) {
        fs.writeFileSync(dataFilePath, JSON.stringify(defaultQuestions, null, 2), "utf8");
    }
}

function loadQuestions() {
    try {
        ensureDataFile();
        const fileData = fs.readFileSync(dataFilePath, "utf8");
        return JSON.parse(fileData);
    } catch (error) {
        console.error("Error loading questions.json:", error);
        return [];
    }
}

function saveQuestions(data) {
    try {
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), "utf8");
    } catch (error) {
        console.error("Error saving questions.json:", error);
    }
}

let questions = loadQuestions();

// =========================
// Utility Functions
// =========================
function getNextQuestionId() {
    if (questions.length === 0) return 1;
    return Math.max(...questions.map(question => question.id)) + 1;
}

function getRelativeTime(dateString) {
    const now = new Date();
    const postedDate = new Date(dateString);
    const diffMs = now - postedDate;

    const minute = 1000 * 60;
    const hour = minute * 60;
    const day = hour * 24;

    if (diffMs < minute) return "Posted Just Now";

    if (diffMs < hour) {
        const mins = Math.floor(diffMs / minute);
        return `Posted ${mins} min${mins > 1 ? "s" : ""} ago`;
    }

    if (diffMs < day) {
        const hours = Math.floor(diffMs / hour);
        return `Posted ${hours} hour${hours > 1 ? "s" : ""} ago`;
    }

    if (diffMs < day * 2) return "Posted Yesterday";

    const days = Math.floor(diffMs / day);
    return `Posted ${days} days ago`;
}

function prepareQuestionsWithTime(data) {
    return data.map(question => ({
        ...question,
        relativeTime: getRelativeTime(question.createdAt),
        replies: question.replies.map(reply => ({
            ...reply,
            relativeTime: getRelativeTime(reply.createdAt)
        }))
    }));
}

function getForumStats(data) {
    const totalQuestions = data.length;
    const totalReplies = data.reduce((sum, question) => sum + question.replies.length, 0);
    const totalModules = new Set(data.map(question => question.module)).size;

    return { totalQuestions, totalReplies, totalModules };
}

// =========================
// Home Page
// =========================
app.get("/", (req, res) => {
    res.render("index");
});

// =========================
// Study Help Forum
// =========================
app.get("/forum", (req, res) => {
    questions = loadQuestions();

    const stats = getForumStats(questions);
    const preparedQuestions = prepareQuestionsWithTime(questions);
    const success = req.query.success || "";

    res.render("forum", {
        questions: preparedQuestions,
        totalQuestions: stats.totalQuestions,
        totalReplies: stats.totalReplies,
        totalModules: stats.totalModules,
        success
    });
});

// =========================
// Add Question
// =========================
app.post("/forum", (req, res) => {
    const { module, title, description } = req.body;

    const newQuestion = {
        id: getNextQuestionId(),
        module: module.trim(),
        title: title.trim(),
        description: description.trim(),
        student: "Current Student",
        createdAt: new Date().toISOString(),
        solved: false,
        replies: []
    };

    questions.unshift(newQuestion);
    saveQuestions(questions);

    res.redirect("/forum?success=question-posted");
});

// =========================
// Reply to Question
// =========================
app.post("/forum/reply/:id", (req, res) => {
    const { reply } = req.body;
    const questionId = parseInt(req.params.id);

    const question = questions.find(q => q.id === questionId);

    if (question && reply.trim() !== "") {
        question.replies.push({
            student: "Current Student",
            text: reply.trim(),
            helpful: 0,
            createdAt: new Date().toISOString()
        });

        saveQuestions(questions);
    }

    res.redirect("/forum?success=reply-posted");
});

// =========================
// Mark as Solved
// =========================
app.post("/forum/solved/:id", (req, res) => {
    const questionId = parseInt(req.params.id);
    const question = questions.find(q => q.id === questionId);

    if (question) {
        question.solved = true;
        saveQuestions(questions);
    }

    res.redirect("/forum");
});

// =========================
// Helpful / Upvote Reply Toggle
// =========================
app.post("/forum/reply/helpful/:questionId/:replyIndex", (req, res) => {
    const questionId = parseInt(req.params.questionId);
    const replyIndex = parseInt(req.params.replyIndex);

    const question = questions.find(q => q.id === questionId);

    if (question && question.replies[replyIndex]) {
        const reply = question.replies[replyIndex];
        reply.helpful = reply.helpful === 0 ? 1 : 0;
        saveQuestions(questions);
    }

    res.redirect("/forum");
});

// =========================
// Delete Question
// =========================
app.post("/forum/delete/:id", (req, res) => {
    const questionId = parseInt(req.params.id);

    questions = questions.filter(question => question.id !== questionId);
    saveQuestions(questions);

    res.redirect("/forum?success=question-deleted");
});

// =========================
// Edit Question Page
// =========================
app.get("/forum/edit/:id", (req, res) => {
    const questionId = parseInt(req.params.id);
    const question = questions.find(q => q.id === questionId);

    if (!question) {
        return res.redirect("/forum");
    }

    res.render("edit", { question });
});

// =========================
// Update Question
// =========================
app.post("/forum/edit/:id", (req, res) => {
    const questionId = parseInt(req.params.id);
    const { module, title, description } = req.body;

    const question = questions.find(q => q.id === questionId);

    if (question) {
        question.module = module.trim();
        question.title = title.trim();
        question.description = description.trim();
        saveQuestions(questions);
    }

    res.redirect("/forum?success=question-updated");
});

// =========================
// Placeholder Pages
// =========================
app.get("/events", (req, res) => {
    res.send("<h2>Events Page Coming Soon</h2>");
});

app.get("/rooms", (req, res) => {
    res.send("<h2>Room Booking Coming Soon</h2>");
});

app.get("/feedback", (req, res) => {
    res.send("<h2>Feedback Page Coming Soon</h2>");
});

app.get("/login", (req, res) => {
    res.send("<h2>Login Page Coming Soon</h2>");
});

// =========================
// Start Server
// =========================
app.listen(PORT, () => {
    console.log(`Server is running successfully on http://localhost:${PORT}`);
});