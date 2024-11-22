import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv"; // Import dotenv

dotenv.config(); // Load environment variables

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Ambil username dari variabel lingkungan
const users = process.env.USERNAMES.split(',').map(username => ({ Username: username }));

// Objek untuk menyimpan koneksi pengguna aktif
const connectedUsers = {}; // { username: socket }

// Endpoint untuk mendapatkan daftar pengguna
app.get('/users', (req, res) => {
    res.json(users);
});

// Middleware untuk memeriksa username
const authenticateSocket = (socket, next) => {
    const username = socket.handshake.headers['username'];
    if (!username) {
        console.log("Username tidak ditemukan.");
        return next(new Error("Unauthorized"));
    }

    const userExists = users.some(user => user.Username === username);

    if (userExists) {
        socket.username = username;
        connectedUsers[username] = socket; // Simpan koneksi socket
        return next();
    } else {
        console.log("Username tidak valid:", username);
        return next(new Error("Unauthorized"));
    }
};

// Gunakan middleware otorisasi saat pengguna terhubung
io.use(authenticateSocket).on("connection", (socket) => {
    console.log(`User ${socket.username} connected`);

    socket.on("sendMessageToUser", (data) => {
        const { targetUsername, messageId: numbers } = data;
    
        // Pastikan messageId adalah number
        const messageId = Number(numbers);  // Atau bisa juga menggunakan parseInt(numbers)
    
        // Periksa apakah messageId berhasil diubah menjadi angka
        if (isNaN(messageId)) {
            socket.emit("messageDelivered", "ID pesan tidak valid. Harus berupa angka.");
            return; // Hentikan proses jika ID pesan tidak valid
        }
    
        // Buat objek pesan ke target
        const msgObject = {
            from: socket.username,
            messageId,  // Sekarang messageId pasti number
            sentAt: new Date().toISOString(), // Format tanggal dan waktu dalam ISO
        };
    
        // Cek apakah pengguna tujuan terhubung
        const targetSocket = connectedUsers[targetUsername];
        if (targetSocket) {
            // Kirim pesan langsung jika pengguna terhubung
            targetSocket.emit("receiveMessage", msgObject);
            // Kirim notifikasi bahwa pesan telah terkirim
            socket.emit("messageDelivered", `Pesan berhasil dikirim ke ${targetUsername}!`);
        } else {
            // Kirim notifikasi bahwa pengguna tidak terhubung
            socket.emit("messageDelivered", `${targetUsername} tidak terhubung. Pesan tidak dapat dikirim.`);
        }
    });    

    // Event untuk mengetik
    socket.on("typing", (data) => {
        const { targetUsername } = data; // Menggunakan format JSON
        const targetSocket = connectedUsers[targetUsername];
        if (targetSocket) {
            targetSocket.emit("userTyping", { from: socket.username });
        }
    });

    // Event untuk recording
    socket.on("recording", (data) => {
        const { targetUsername } = data; // Menggunakan format JSON
        const targetSocket = connectedUsers[targetUsername];
        if (targetSocket) {
            targetSocket.emit("userTyping", { from: socket.username });
        }
    });

    socket.on("disconnect", () => {
        console.log(`User ${socket.username} disconnected`);
        // Hapus koneksi socket dari objek connectedUsers
        delete connectedUsers[socket.username];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
