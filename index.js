import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv"; // Import dotenv

dotenv.config(); // Load environment variables

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Ambil user id  dari variabel lingkungan
const users = process.env.IDS.split(',').map(userId => ({ userId: userId }));

// Objek untuk menyimpan koneksi pengguna aktif
const connectedUsers = {}; // { userId: socket }

// Endpoint untuk mendapatkan daftar pengguna
app.get('/users', (req, res) => {
    res.json(users);
});

// Middleware untuk memeriksa userId
const authenticateSocket = (socket, next) => {
    const userId = socket.handshake.headers['user_id'];
    if (!userId) {
        console.log("User tidak ditemukan.");
        return next(new Error("Unauthorized"));
    }

    const userExists = users.some(user => user.userId === userId);

    if (userExists) {
        socket.userId = userId;
        connectedUsers[userId] = socket; // Simpan koneksi socket
        return next();
    } else {
        console.log("User tidak valid:", userId);
        return next(new Error("Unauthorized"));
    }
};

// Gunakan middleware otorisasi saat pengguna terhubung
io.use(authenticateSocket).on("connection", (socket) => {
    socket.on("sendMessageToUser", (data) => {
        const { target_id, message_id: numbers } = data;
    
        // Pastikan messageId adalah number
        const message_id = Number(numbers);  // Atau bisa juga menggunakan parseInt(numbers)
    
        // Periksa apakah messageId berhasil diubah menjadi angka
        if (isNaN(message_id)) {
            socket.emit("messageDelivered", "ID pesan tidak valid. Harus berupa angka.");
            return; // Hentikan proses jika ID pesan tidak valid
        }
    
        const userId = Number(socket.userId);  // Mengubah socket.userId menjadi number

        // Buat objek pesan ke target
        const msgObject = {
            from: userId,
            message_id,  // Sekarang messageId pasti number
            sentAt: new Date().toISOString(), // Format tanggal dan waktu dalam ISO
        };
    
        // Cek apakah pengguna tujuan terhubung
        const targetSocket = connectedUsers[target_id];
        if (targetSocket) {
            // Kirim pesan langsung jika pengguna terhubung
            targetSocket.emit("receiveMessage", msgObject);
            // Kirim notifikasi bahwa pesan telah terkirim
            socket.emit("messageDelivered", `Pesan berhasil dikirim ke ${target_id}!`);
        } else {
            // Kirim notifikasi bahwa pengguna tidak terhubung
            socket.emit("messageDelivered", `${target_id} tidak terhubung. Pesan tidak dapat dikirim.`);
        }
    });    

    // Event untuk mengetik
    socket.on("typing", (data) => {
        const { target_id } = data; // Menggunakan format JSON
        const targetSocket = connectedUsers[target_id];
        if (targetSocket) {
            const userId = Number(socket.userId);  // Mengubah socket.userId menjadi number
            targetSocket.emit("userTyping", { from: userId });
        }
    });

    // Event untuk recording
    socket.on("recording", (data) => {
        const { target_id } = data; // Menggunakan format JSON
        const targetSocket = connectedUsers[target_id];
        if (targetSocket) {
            targetSocket.emit("userTyping", { from: socket.userId });
        }
    });

    socket.on("disconnect", () => {
        console.log(`User ${socket.userId} disconnected`);
        // Hapus koneksi socket dari objek connectedUsers
        delete connectedUsers[socket.userId];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
