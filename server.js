// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Frontend static files serve karne ke liye
app.use(express.static(path.join(__dirname, 'public')));

// Active rooms ko track karne ke liye
const activeRooms = {};

// 6-digit random code generator (Uppercase + Numerical)
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Confusing letters (O, 0, I, 1) hata diye hain
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Sender room create karega
    socket.on('create-room', (callback) => {
        let code = generateRoomCode();
        while (activeRooms[code]) {
            code = generateRoomCode(); // Ensure uniqueness
        }
        activeRooms[code] = socket.id;
        socket.join(code);
        callback({ success: true, code: code });
        console.log(`Room created with code: ${code}`);
    });

    // Receiver room join karega code daalkar
    socket.on('join-room', (code, callback) => {
        const senderSocketId = activeRooms[code];
        if (senderSocketId) {
            socket.join(code);
            // Sender ko batao ki receiver aa gaya hai, connection shuru karo
            io.to(senderSocketId).emit('receiver-joined', socket.id);
            callback({ success: true });
        } else {
            callback({ success: false, message: 'Invalid or expired code!' });
        }
    });

    // WebRTC Signaling Relay (Offer, Answer, ICE Candidates)
    socket.on('signal', (data) => {
        io.to(data.target).emit('signal', {
            sender: socket.id,
            signal: data.signal
        });
    });

    socket.on('disconnect', () => {
        // Clean up rooms if user disconnects
        for (let code in activeRooms) {
            if (activeRooms[code] === socket.id) {
                delete activeRooms[code];
                break;
            }
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});