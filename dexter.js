const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');
const express = require('express');
const { Client } = require('pg');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = process.env.PORT || 3000;
// DATABASE URL එක දපන් 
const db = new Client({
    connectionString: "postgresql://status_1g8m_user:XP1Xb6P26n98R1fwT7Tq6q4gmUYauPDp@dpg-d2f0isripnbc73ahu2lg-a.oregon-postgres.render.com/status_1g8m",
    ssl: { rejectUnauthorized: false }
});
db.connect();

(async () => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS wame_status (
            id SERIAL PRIMARY KEY,
            number TEXT UNIQUE,
            saved_at TIMESTAMP DEFAULT NOW()
        );
    `);
})();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get("/", (req, res) => res.send("🥷 TADASHI STATUE BOT CONNECTED SUCCESSFUL 💀"));

app.post('/add', async (req, res) => {
    const { number } = req.body;
    if (!number || !/^\d{9,15}$/.test(number)) {
        return res.status(400).json({ error: 'Invalid number format' });
    }
    try {
        await db.query(
            `INSERT INTO wame_status (number) VALUES ($1)
             ON CONFLICT (number) DO UPDATE SET saved_at = NOW()`,
            [number]
        );
        res.json({ message: `Number ${number} added/updated successfully` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add number' });
    }
});

app.get('/check/:number', async (req, res) => {
    const { number } = req.params;
    try {
        const { rows } = await db.query(
            `SELECT * FROM wame_status WHERE number = $1 AND saved_at > NOW() - INTERVAL '2 days'`,
            [number]
        );
        if (rows.length > 0) {
            res.json({ exists: true, saved_at: rows[0].saved_at });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to check number' });
    }
});

app.delete('/delete/:number', async (req, res) => {
    const { number } = req.params;
    try {
        const { rowCount } = await db.query(
            `DELETE FROM wame_status WHERE number = $1`,
            [number]
        );
        if (rowCount > 0) {
            res.json({ message: `Number ${number} deleted successfully` });
        } else {
            res.json({ message: `Number ${number} not found` });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete number' });
    }
});

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.on('message', (message) => {
        if (message === '@DEXTER-ID-2007-27') {
            ws.send(JSON.stringify({ auth: true }));
        }
    });
});
function broadcastLog(log) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(log));
        }
    });
}

const MY_WAME_LINK = "https://Wa.me//+94743370472?text=*𝓗𝓮𝔂𝔂+𝕿𝖆𝖉𝖆𝖘𝖍𝖎++𓁹‿𓁹++𓅪*";
const MY_NUMBER = "94743370472";

function getRandom(ext = '') {
    return `${Math.floor(Math.random() * 10000)}${ext}`;
}

let reconnectRetries = 0;
const MAX_RECONNECT_RETRIES = 1000000;

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function addNumberToDB(sock, jid, num, msg = null) {
    try {
        await db.query(
            `INSERT INTO wame_status (number) VALUES ($1)
             ON CONFLICT (number) DO UPDATE SET saved_at = NOW()`,
            [num]
        );
        const responseMessage = `*✅ Number ${num} මතක තියං ඉන්නවා හොදේ මොනො උනත් කියපු ගමන් link එක status දලා දුන්නට Respect 🤍*`;
        if (msg) {
            await sock.sendMessage(jid, { text: responseMessage }, { quoted: msg });
        } else {
            await sock.sendMessage(jid, { text: responseMessage });
        }
    } catch (err) {
        console.error("DB Insert Error:", err);
        await sock.sendMessage(jid, { text: `❌ Failed to add ${num} to database.` });
    }
}

async function checkNumberInDB(sock, jid, num) {
    try {
        const { rows } = await db.query(
            `SELECT * FROM wame_status WHERE number = $1 AND saved_at > NOW() - INTERVAL '2 days'`,
            [num]
        );
        if (rows.length > 0) {
            await sock.sendMessage(jid, { text: `*✅ Number ${num} is in the database, saved at ${rows[0].saved_at}.*` });
        } else {
            await sock.sendMessage(jid, { text: `*❌ Number ${num} is not in the database.*` });
        }
    } catch (err) {
        console.error("DB Check Error:", err);
        await sock.sendMessage(jid, { text: `❌ Failed to check ${num} in database.` });
    }
}

const anticallMessages = [
    // Auto call reject massage 
    "*Sorry, I can't take calls right now. Please message me instead! 😊*\n\n> ᴛᴀᴅᴀꜱʜɪ",
    "*Calls are not allowed. Drop a text! 📩*\n\n> ᴛᴀᴅᴀꜱʜɪ",
    "*I'm busy at the moment. Text me your query. 🙏*\n\n> ᴛᴀᴅᴀꜱʜɪ",
    "*No calls please! Let's chat via messages. 💬*\n\n> ᴛᴀᴅᴀꜱʜɪ",
    "*Call rejected. Please send a message instead. 🚫*\n\n> ᴛᴀᴅᴀꜱʜɪ",

    // Sinhala messages
    "*කරුණාකරලා call කරන්න එපා. Message එකක් දාන්න 😊*\n\n> ᴛᴀᴅᴀꜱʜɪ",
    "*මට දැන් call ගන්න බෑ. Text එකක් දාන්නකෝ. 📩*\n\n> ᴛᴀᴅᴀꜱʜɪ",
    "*Call එපා Message එකකින් කියන්න. 💬*\n\n> ᴛᴀᴅᴀꜱʜɪ",
    "*මම busy යි. Message එකක් දාන්න. 🙏*\n\n> ᴛᴀᴅᴀꜱʜɪ",
    "*Call reject කලා. Text එකක් දාන්නකෝ. 🚫*\n\n> ᴛᴀᴅᴀꜱʜɪ"
];

function getRandomAnticallMessage() {
    const randomIndex = Math.floor(Math.random() * anticallMessages.length);
    return anticallMessages[randomIndex];
}
const reactionEmojis = ['🇱🇰', '❤️', '💙', '🤍', '🍃'];

function getRandomEmoji() {
    const randomIndex = Math.floor(Math.random() * reactionEmojis.length);
    return reactionEmojis[randomIndex];
}

async function connectToWA() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode || 0;
                console.log(`🔄 Connection closed with status code ${statusCode}, retrying...`);
                if (reconnectRetries < MAX_RECONNECT_RETRIES) {
                    reconnectRetries++;
                    await delay(3000);
                    connectToWA();
                }
            } else if (connection === 'open') {
                reconnectRetries = 0;
                console.log('✅ TADASHI BOT Connected!');
                await sock.sendMessage('94754415943@s.whatsapp.net', { text: '✅ TADASHI BOT Connected Successfully! 🚀' });
            }
        });

        sock.ev.on('call', async (calls) => {
            try {
                for (const call of calls) {
                    if (call.status === 'offer') {
                        const callerJid = call.from;

                        // Reject the call
                        await sock.rejectCall(call.id, callerJid);
                        console.log(`🚫 Rejected call from ${callerJid}`);

                        // Send random anticall message
                        const randomMessage = getRandomAnticallMessage();
                        await sock.sendMessage(callerJid, { text: randomMessage });

                        // Broadcast log to WebSocket (call log)
                        broadcastLog({
                            type: 'call',
                            from: callerJid.split('@')[0],
                            message: 'Call rejected and message sent',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            } catch (err) {
                console.error('Error handling call:', err);
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.key.remoteJid || msg.key.fromMe) return;

                const body =
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text || "";

                if (body.startsWith(".add ")) {
                    const num = body.replace(".add ", "").trim();
                    if (/^\d{9,15}$/.test(num)) {
                        await addNumberToDB(sock, msg.key.remoteJid, num);
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, { text: "❌ Invalid number format." });
                    }
                    return;
                }

                if (body.startsWith(".check ")) {
                    const num = body.replace(".check ", "").trim();
                    if (/^\d{9,15}$/.test(num)) {
                        await checkNumberInDB(sock, msg.key.remoteJid, num);
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, { text: "❌ Invalid number format." });
                    }
                    return;
                }

                if (msg.key.remoteJid === 'status@broadcast') {
                    await sock.readMessages([{
                        remoteJid: 'status@broadcast',
                        id: msg.key.id,
                        participant: msg.key.participant || undefined
                    }]);

                    const captionText =
                        msg.message?.imageMessage?.caption ||
                        msg.message?.videoMessage?.caption ||
                        msg.message?.extendedTextMessage?.text || "";

                    if (/https?:\/\/wa\.me/i.test(captionText)) {
                        const statusOwner = msg.key.participant || msg.participant || msg.key.remoteJid;
                        const num = statusOwner.split('@')[0].replace(/\D/g, "");
                        const { rows } = await db.query(
                            `SELECT * FROM wame_status WHERE number = $1 AND saved_at > NOW() - INTERVAL '2 days'`,
                            [num]
                        );
                        await sock.sendMessage('status@broadcast', {
                            react: {
                                text: getRandomEmoji(),
                                key: msg.key
                            }
                        });

                        broadcastLog({
                            type: 'status',
                            number: num,
                            link: captionText,
                            timestamp: new Date().toISOString()
                        });

                        if (captionText.includes(MY_NUMBER)) {
                            
                            if (rows.length === 0) {
                                await addNumberToDB(sock, statusOwner, num, msg); 
                                await sock.sendMessage(statusOwner, { 
                                    text: "*🤍 TNX මගේ link status දලා support කලාට 🤍*" 
                                }, { quoted: msg });
                            }
                        } else if (rows.length === 0) {
                            
                            await sock.sendMessage(statusOwner, {
                                image: fs.readFileSync('8634e0a4474ec1f344b9f312cbe226b3.jpg'),
                                caption: `https://Wa.me//+94743370472?text=*Ｈᴇʏㅤᴛᴀᴅᴀꜱʜɪ*\n\n*𝗦𝗧𝗔𝗧𝗨𝗦 𝗩𝗜𝗘𝗪𝗦 𝗢𝗡𝗟𝗬 𝗩𝗜𝗘𝗪𝗦 𝗟𝗜𝗡𝗞 𝗖𝗟𝗜𝗖𝗞 🫀⃞👻 ⚠️*\n\n*❯ ᴄᴏᴍᴇ ʜᴇʀᴇ ᴍʏ ɪɴʙᴏx ᴀɴᴅ ꜱᴀᴠᴇ 🫂🍃 ▶︎ •၊၊||၊|။||||။‌‌‌‌‌⁊|• 0 :10*`
                            }, { quoted: msg });

                            setTimeout(async () => {
                                try {
                                    await sock.sendMessage(statusOwner, {
                                        audio: { url: "https://files.catbox.moe/7htpw5.mp3" }, // audio url එක දපන් 😪
                                        mimetype: 'audio/mpeg',
                                        ptt: true
                                    }, { quoted: msg });
                                } catch (e) {
                                    console.error("Error sending voice note:", e);
                                }
                            }, 30000); 
                        }
                    }
                }
            } catch (err) {
                console.error('Error in messages.upsert:', err);
            }
        });

        setInterval(async () => {
            await db.query(`DELETE FROM wame_status WHERE saved_at < NOW() - INTERVAL '2 days'`);
        }, 60 * 60 * 1000);

    } catch (err) {
        console.error('Failed to connect to WhatsApp:', err);
        if (reconnectRetries < MAX_RECONNECT_RETRIES) {
            reconnectRetries++;
            await delay(3000);
            connectToWA();
        }
    }
}

setTimeout(() => {
    connectToWA();
}, 3000);

server.listen(port, () => console.log(`Server on http://localhost:${port}`));
