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
    // Ambil userId dari query parameters pada URL koneksi
    const userId = socket.handshake.query.user_id; 

    if (!userId) {
        console.log("User tidak ditemukan.");
        return next(new Error("Unauthorized"));
    }

    const userExists = users.some(user => user.userId === userId);

    if (userExists) {
        socket.userId = userId;

        // Menambahkan socket ke array untuk pengguna ini
        if (!connectedUsers[userId]) {
            connectedUsers[userId] = [];
        }
        connectedUsers[userId].push(socket); // Menambahkan socket baru ke dalam array
        console.log(`User ${userId} connected on socket ${socket.id}`);
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
    
        // Buat objek pesan ke target
        const msgObject = {
            from: socket.userId,
            message_id,  // Sekarang messageId pasti number
            sentAt: new Date().toISOString(), // Format tanggal dan waktu dalam ISO
        };
    
        // Cek apakah pengguna tujuan terhubung
        const targetSockets = connectedUsers[target_id];  // Ambil semua soket yang terhubung dengan target_id
        if (targetSockets) {
            // Kirim pesan ke semua soket yang terhubung dengan target_id
            targetSockets.forEach(targetSocket => {
                targetSocket.emit("receiveMessage", msgObject);
            });
            // Kirim notifikasi bahwa pesan telah terkirim
            socket.emit("messageDelivered", `Pesan berhasil dikirim ke ${target_id}!`);
        } else {
            // Kirim notifikasi bahwa pengguna tidak terhubung
            socket.emit("messageDelivered", `${target_id} tidak terhubung. Pesan tidak dapat dikirim.`);
        }
    });

    socket.on("deleteMessages", (data) => {
        if (!data || typeof data !== "object") {
            console.error("Data tidak valid:", data);
            // socket.emit("error", "Format data tidak valid.");
            return;
        }

        const { target_id, message_ids } = data;
    
        // Normalisasi input: jika bukan array, ubah menjadi array
        const messageIds = Array.isArray(message_ids) ? message_ids : [message_ids];
    
        // Validasi: Pastikan semua ID valid
        if (messageIds.some(id => typeof id !== "number" && typeof id !== "string")) {
            // socket.emit("messagesDeleted", "Format message_ids tidak valid. Harus berupa number atau array of numbers.");
            return;
        }
    
        const targetSockets = connectedUsers[target_id];
        if (targetSockets) {
            targetSockets.forEach(targetSocket => {
                targetSocket.emit("messagesDeleted", {
                    from: socket.userId,
                    to: target_id,
                    message_ids: messageIds,
                    deletedAt: new Date().toISOString()
                });
            });
        }
    });    

    // Event untuk mengetik
    socket.on("typing", (data) => {
        const { target_id } = data; // Menggunakan format JSON
        const targetSockets = connectedUsers[target_id];
        if (targetSockets) {
            targetSockets.forEach(targetSocket => {
                targetSocket.emit("userTyping", { from: socket.userId });
            });
        }
    });
    
    // Event untuk recording
    socket.on("recording", (data) => {
        const { target_id } = data; // Menggunakan format JSON
        const targetSockets = connectedUsers[target_id];
        if (targetSockets) {
            targetSockets.forEach(targetSocket => {
                targetSocket.emit("userRecording", { from: socket.userId });
            });
        }
    });
    

    socket.on("disconnect", () => {
        console.log(`User ${socket.userId} disconnected`);
    
        // Hapus socket yang terputus dari array
        const userSockets = connectedUsers[socket.userId];
        if (userSockets) {
            // Hapus socket yang terputus dari array
            connectedUsers[socket.userId] = userSockets.filter(s => s.id !== socket.id);
            
            // Jika tidak ada socket yang terhubung lagi, hapus userId dari connectedUsers
            if (connectedUsers[socket.userId].length === 0) {
                delete connectedUsers[socket.userId];
            }
        }
    });
    
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
