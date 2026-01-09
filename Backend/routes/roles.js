import express from "express";

// Deprecated: roles endpoints removed in favor of `users` which store role as a string.
const router = express.Router();

router.use((req, res) => {
    res.status(410).json({
        error: "Roles endpoints removed. Use /api/users instead.",
    });
});

export default router;
