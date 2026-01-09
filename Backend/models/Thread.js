import mongoose from "mongoose";
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
    role: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    name: {
        type: String,
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

const ThreadSchema = new Schema({
    threadId: {
        type: String,
        required: true,
    },

    title: {
        type: String,
        required: true,
        default: "New Chat",
    },

    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },

    messages: [MessageSchema],

    createdAt: {
        type: Date,
        default: Date.now,
    },

    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// make threadId unique per owner (allow same threadId for different users)
ThreadSchema.index({ threadId: 1, owner: 1 }, { unique: true });

export default mongoose.model("Thread", ThreadSchema);
