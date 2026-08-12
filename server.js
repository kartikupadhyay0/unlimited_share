const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const rooms = {};

// Helper: Unique 6-digit code generator
function generateUniqueCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (rooms[code]); // Jab tak unique code na mile
    return code;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Sender creates a room
    socket.on('create-room', (callback) => {
        const code = generateUniqueCode();
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
        if (data.target) {
            io.to(data.target).emit('signal', {
                sender: socket.id,
                signal: data.signal
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Clean up rooms and notify peers
        for (let code in rooms) {
            if (rooms[code] === socket.id) {
                // Notify everyone in room that sender disconnected
                socket.to(code).emit('peer-disconnected');
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