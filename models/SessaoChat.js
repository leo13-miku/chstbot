import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    role: { type: String, required: true },
    parts: [{
        text: { type: String, required: true }
    }]
}, { _id: false });
const sessaoChatSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, default: 'anonimo' },
    botId: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    messages: [messageSchema],
    loggedAt: { type: Date, default: Date.now }
}, {
    collection: 'sessoesChat'
});
const SessaoChat = mongoose.model('SessaoChat', sessaoChatSchema);
export default SessaoChat;