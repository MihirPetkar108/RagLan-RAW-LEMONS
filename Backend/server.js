import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import chatRoutes from "./routes/chat.js";
import usersRoutes from "./routes/users.js";

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(cors());

app.use("/api", chatRoutes);
app.use("/api", usersRoutes);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB!");
    } catch (err) {
        console.log(`Failed to connect to DB ${err}`);
    }
};

app.listen(PORT, (req, res) => {
    console.log(`Server listening at port ${PORT}`);
    connectDB();
});
