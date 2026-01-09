import express from "express";
import User from "../models/User.js";

const router = express.Router();

// Get all users
router.get("/users", async (req, res) => {
    try {
        const users = await User.find({}).select("name role").sort({ name: 1 });
        res.json(users);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Create a user
router.post("/users", async (req, res) => {
    const { name, role, password } = req.body;
    if (!name || !role || !password)
        return res
            .status(400)
            .json({ error: "Missing name, role or password" });
    try {
        const existing = await User.findOne({ name });
        if (existing)
            return res.status(400).json({ error: "User already exists" });

        const user = new User({ name, role, password });
        await user.save();
        // do not return password in response
        const returned = { _id: user._id, name: user.name, role: user.role };
        res.status(201).json(returned);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to create user" });
    }
});
// Login endpoint
router.post("/login", async (req, res) => {
    const { name, password } = req.body;
    if (!name || !password)
        return res.status(400).json({ error: "Missing name or password" });
    try {
        const user = await User.findOne({ name });
        if (!user || !user.password) {
            return res.status(401).json({ error: "Invalid name" });
        }

        if (user.password !== password) {
            return res.status(401).json({ error: "Invalid password" });
        }

        // success — do not return password
        const returned = { _id: user._id, name: user.name, role: user.role };
        res.json(returned);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Login failed" });
    }
});

export default router;
