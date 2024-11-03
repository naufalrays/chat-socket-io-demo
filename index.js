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

    // Event untuk mengirim pesan ke pengguna tertentu
    socket.on("sendMessageToUser", (data) => {
        const { targetUsername, message } = data; // Menggunakan format JSON
        console.log(`Pesan dari ${socket.username} ke ${targetUsername}: ${message}`);

        // Buat objek pesan
        const msgObject = {
            from: socket.username,
            message,
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
