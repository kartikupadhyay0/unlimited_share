const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' folder (agar index.html public folder mein hai, nahi toh current directory se)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Sender creates a room with a random 6-digit code
    socket.on('create-room', (callback) => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[code] = socket.id;
        socket.join(code);
        callback({ success: true, code: code });
        console.log(`Room created: ${code} by ${socket.id}`);
    });

    // Receiver joins the room using the code
    socket.on('join-room', (code, callback) => {
        const senderId = rooms[code];
        if (senderId) {
            socket.join(code);
            callback({ success: true });
            // Notify sender that receiver has joined
            io.to(senderId).emit('receiver-joined', socket.id);
            console.log(`User ${socket.id} joined room: ${code}`);
        } else {
            callback({ success: false, message: 'Invalid or expired code!' });
        }
    });

    // WebRTC Signaling (Offer, Answer, ICE candidates exchange)
    socket.on('signal', (data) => {
        io.to(data.target).emit('signal', {
            sender: socket.id,
            signal: data.signal
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Clean up rooms if needed
        for (let code in rooms) {
            if (rooms[code] === socket.id) {
                delete rooms[code];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});