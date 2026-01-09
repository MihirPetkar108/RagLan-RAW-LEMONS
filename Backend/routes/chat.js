import express from "express";
import mongoose from "mongoose";
import multer from "multer"; // Import multer
import Thread from "../models/Thread.js";
import User from "../models/User.js";
// import getOpenAIAPIResponse from "../utils/openai.js"; // Comment out OpenAI import

const router = express.Router();

// Configure Multer for Disk Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/') // Make sure this folder exists
    },
    filename: function (req, file, cb) {
        // Save with timestamp to avoid name collisions
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + '-' + file.originalname)
    }
})

const upload = multer({ storage: storage });

// Get all threads
router.get("/thread", async (req, res) => {
    const { userId } = req.query;
    try {
        let query = {};
        if (userId) {
            // ensure valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: "Invalid userId" });
            }
            // Only return threads owned by the requesting user
            query = { owner: new mongoose.Types.ObjectId(userId) };
        }

        const threads = await Thread.find(query).sort({ updatedAt: -1 });
        res.send(threads);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to Fetch Threads!" });
    }
});

// Get a particular thread (populate message authors and their roles)
router.get("/thread/:threadId", async (req, res) => {
    const { threadId } = req.params;
    const { userId } = req.query;

    try {
        let query = { threadId };

        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: "Invalid userId" });
            }
            query.owner = new mongoose.Types.ObjectId(userId);
        }

        let thread = await Thread.findOne(query).populate({
            path: "messages.author",
            select: "name role",
        });

        // fallback: if userId provided but no owner match, check if user is in messages.author (for legacy threads)
        if (!thread && userId) {
            thread = await Thread.findOne({
                threadId,
                "messages.author": new mongoose.Types.ObjectId(userId),
            }).populate({ path: "messages.author", select: "name role" });
        }

        if (!thread) {
            return res
                .status(404)
                .json({ error: "This thread was not found!" });
        }

        res.json(thread.messages);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to Fetch Chat!" });
    }
});

// Init endpoint: return user's threads and the most recently updated thread's messages
router.get("/user/:userId/init", async (req, res) => {
    const { userId } = req.params;

    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid userId" });
        }

        // fetch threads for the user sorted by updatedAt desc
        const threads = await Thread.find({
            owner: new mongoose.Types.ObjectId(userId),
        })
            .sort({ updatedAt: -1 })
            .select("threadId title updatedAt");

        let lastThread = null;
        if (threads.length > 0) {
            const t = threads[0];
            const full = await Thread.findOne({
                threadId: t.threadId,
                owner: t.owner,
            }).populate({
                path: "messages.author",
                select: "name role",
            });
            if (full) {
                lastThread = {
                    threadId: full.threadId,
                    messages: full.messages,
                };
            }
        }

        res.json({ threads, lastThread });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch user init data" });
    }
});

// Delete a thread
router.delete("/thread/:threadId", async (req, res) => {
    const { threadId } = req.params;
    const { userId } = req.query;

    try {
        let filter = { threadId };
        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: "Invalid userId" });
            }
            filter.owner = new mongoose.Types.ObjectId(userId);
        }

        const threadDeleted = await Thread.findOneAndDelete(filter);

        if (!threadDeleted) {
            return res.status(404).json({
                error: "Thread not found!",
            });
        }

        res.status(200).json({ success: "Thread Deleted Successfully!" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to Fetch Chat!" });
    }
});

// New Chat / Update Chat
router.post("/chat", upload.array('files'), async (req, res) => {
    const { threadId, message, name, role, userId } = req.body;

    // Log received files to the terminal
    if (req.files && req.files.length > 0) {
        console.log("--- Received Files ---");
        req.files.forEach(file => {
            console.log(`File: ${file.originalname} | Size: ${file.size} bytes | Type: ${file.mimetype}`);
        });
        console.log("----------------------");
    }

    if (!threadId || !message) {
        console.error("400 Error: Missing threadId or message", { threadId, message });
        return res.status(400).json({
            error: "Missing required fields! (threadId, message)",
        });
    }

    // Require authenticated userId for chat operations to avoid creating users
    // implicitly by name. Clients should supply the logged-in user's _id.
    if (!userId) {
        console.error("400 Error: Missing userId");
        return res.status(400).json({
            error: "Missing userId: please login and include userId in request body",
        });
    }

    if (role === "assistant") {
        return res
            .status(400)
            .json({ error: "Cannot create a user with role 'assistant'" });
    }

    try {
        // Determine user: prefer explicit userId (from logged-in client),
        // otherwise fall back to name-based lookup/creation for legacy clients.
        let user = null;
        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                console.error("400 Error: Invalid userId format", userId);
                return res.status(400).json({ error: "Invalid userId" });
            }
            user = await User.findById(userId);
            if (!user) {
                console.error("400 Error: User not found", userId);
                return res
                    .status(400)
                    .json({ error: "User not found for userId" });
            }
            // if role provided, ensure it matches
            if (role && user.role !== role) {
                console.error("400 Error: Role mismatch", { sentRole: role, dbRole: user.role });
                return res
                    .status(400)
                    .json({ error: "Role mismatch for userId" });
            }
        }

        // scope thread lookup to the user so users cannot write to other users' threads
        let thread = await Thread.findOne({ threadId, owner: user._id });

        const msg = {
            role: role,
            content: message,
            author: user._id,
            name: user.name,
        };

        if (!thread) {
            thread = new Thread({
                threadId,
                title: message,
                messages: [msg],
                owner: user._id,
            });
        } else {
            thread.messages.push(msg);
        }

        // HARDCODED RESPONSE instead of OpenAI for now
        // const assistantReply = await getOpenAIAPIResponse(message);
        const fileCount = req.files ? req.files.length : 0;
        const assistantReply = `This is a hardcoded response from the server. I received your message: "${message}" and ${fileCount} file(s).`;

        thread.messages.push({
            role: "assistant",
            content: assistantReply,
            name: "assistant",
        });
        thread.updatedAt = new Date();
        await thread.save();

        res.json({ reply: assistantReply });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to Fetch Chat!" });
    }
});

export default router;
