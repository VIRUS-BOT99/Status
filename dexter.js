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

// DATABASE
const db = new Client({
    connectionString: "postgresql://data_wrs1_user:yjPBCMyJvJKeFdYu4GRo09qo0R3PEAdn@dpg-d2g2l68gjchc73ajklng-a.oregon-postgres.render.com/data_wrs1",
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

    await db.query(`
        CREATE TABLE IF NOT EXISTS wame_sent (
            id SERIAL PRIMARY KEY,
            number TEXT UNIQUE,
            sent_at TIMESTAMP DEFAULT NOW()
        );
    `);
})();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get("/", (req, res) => res.send("🥷 TADASHI STATUE BOT CONNECTED SUCCESSFUL 💀"));

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

const MY_NUMBER = "94743370472";

function getRandomEmoji() {
    const reactionEmojis = ['🇱🇰', '❤️', '💙', '🤍', '🍃'];
    return reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
}

// Function DB Insert
async function addNumberToDB(sock, statusOwner, num, msg) {
    try {
        await db.query(
            `INSERT INTO wame_status (number) VALUES ($1)
             ON CONFLICT (number) DO UPDATE SET saved_at = NOW()`,
            [num]
        );
        console.log(`✅ Number ${num} added to DB`);
    } catch (e) {
        console.error("Error saving number to DB:", e);
    }
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
            const { connection } = update;
            if (connection === 'open') {
                console.log('✅ TADASHI BOT Connected!');
                await sock.sendMessage('94754415943@s.whatsapp.net', { text: '✅ TADASHI BOT Connected Successfully! 🚀' });
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.key.remoteJid || msg.key.fromMe) return;

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

                        const { rows } = await db.query(
                            `SELECT * FROM wame_status WHERE number = $1`,
                            [num]
                        );

                        if (captionText.includes(MY_NUMBER)) {
                            if (rows.length === 0) {
                                await addNumberToDB(sock, statusOwner, num, msg);
                                await sock.sendMessage(statusOwner, {
                                    text: "*ʟɪɴᴋ ꜱᴛᴀᴛᴜꜱ දලා දුන්නට ᴛɴx ආදරෙයු 😘⃞🤭*"
                                }, { quoted: msg });
                            }
                        } else if (rows.length === 0) {
                            await addNumberToDB(sock, statusOwner, num, msg);

                            await sock.sendMessage(statusOwner, {
                                image: fs.readFileSync('8634e0a4474ec1f344b9f312cbe226b3.jpg'),
                                caption: `https://Wa.me//+94743370472?text=*Ｈᴇʏㅤᴛᴀᴅᴀꜱʜɪ*\n\n*𝗦𝗧𝗔𝗧𝗨𝗦 𝗩𝗜𝗘𝗪𝗦 𝗢𝗡𝗟𝗬 𝗩𝗜𝗘𝗪𝗦 𝗟𝗜𝗡𝗞 𝗖𝗟𝗜𝗖𝗞 🫀⃞👻 ⚠️*\n\n*❯ ᴄᴏᴍᴇ ʜᴇʀᴇ ᴍʏ ɪɴʙᴏx ᴀɴᴅ ꜱᴀᴠᴇ 🫂🍃 ▶︎ •၊၊||၊|။||||။‌‌‌‌‌⁊|• 0 :10*`
                            }, { quoted: msg });

                            setTimeout(async () => {
                                try {
                                    await sock.sendMessage(statusOwner, {
                                        audio: { url: "https://files.catbox.moe/e1l02r.mp3" },
                                        mimetype: 'audio/mpeg',
                                        ptt: true
                                    }, { quoted: msg });
                                } catch (e) {
                                    console.error("Error sending voice note:", e);
                                }
                            }, 30000);
                        }

                        const match = captionText.match(/wa\.me\/\+?(\d{9,15})/i);
                        if (match) {
                            const otherNum = match[1];

                            const { rows: countRows } = await db.query(
                                `SELECT COUNT(*)::int AS count FROM wame_sent WHERE sent_at::date = CURRENT_DATE`
                            );
                            const sentCount = countRows[0].count;
                           // 50 වෙනුවට කැමැති count එකක් දහන් ඔකෙන් වෙන්නෙ link වලට massage යවන limited එක එ කියන්නෙ දවසට link 50 කට විතරයි massage යන්නෙ 👉👈
                            if (sentCount < 10000) {
                                const { rows: existsRows } = await db.query(
                                    `SELECT * FROM wame_sent WHERE number = $1 AND sent_at::date = CURRENT_DATE`,
                                    [otherNum]
                                );

                                if (existsRows.length === 0) {
                                    try {
                                        await sock.sendMessage(otherNum + "@s.whatsapp.net", {
                                            text: "*Link එකෙන් ආවේ Save කරගන්න🫵✅*\n\n┏━━━━━━━━━━━━━━━━━━━━━━━━━┓\n ▏  *ㅤㅤＳＴＡＴＵＳᴠɪᴇᴡꜱ ᴏɴʟʏㅤʏ⃞*\n╋━━━━━━━━━━━━━━━━━━━━━━━━━╋\n\n*▍ＮＡＭＥ ➳ 𝐓ᴀᴅ͢ᴀꜱʜɪ͢ッ🚀*\n*▍ＡＧＥ ➳ -17❖🍃*\n*▍ＦＲＯＭ ➳ 𝐁ᴀɴᴅᴀʀᴀᴡᴇʟᴀ🍁*\n*▍ＧＡＮＤＥＲ ➳ 𝐁𝙾𝚈☻🛸*\n\n╋━━━━━━━━━━━━━━━━━━━━━━━━━╋\n\n*ඔයාගෙ නම කියන්න Save කරගන්න😒🫵*"
                                        });

                                        await db.query(
                                            `INSERT INTO wame_sent (number) VALUES ($1)
                                             ON CONFLICT (number) DO UPDATE SET sent_at = NOW()`,
                                            [otherNum]
                                        );
                                    } catch (e) {
                                        console.error("Error sending message to extracted number:", e);
                                    }

                                    try {
                                        await sock.sendMessage(statusOwner, {
                                            text: `*Okay his inbox went ❤️‍🩹⃞✅*`
                                        }, { quoted: msg });
                                    } catch (e) {
                                        console.error("Error sending message to status owner:", e);
                                    }
                                }
                            } else {
                                console.log("🚫 Daily limit (10000) reached. No more messages will be sent today.");
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Error in messages.upsert:', err);
            }
        });
        setInterval(async () => {
            await db.query(`DELETE FROM wame_status WHERE saved_at < NOW() - INTERVAL '2 days'`);
            await db.query(`DELETE FROM wame_sent WHERE sent_at < NOW() - INTERVAL '2 days'`);
        }, 60 * 60 * 1000);

    } catch (err) {
        console.error('Failed to connect to WhatsApp:', err);
    }
}

setTimeout(() => {
    connectToWA();
}, 3000);

server.listen(port, () => console.log(`Server on http://localhost:${port}`));
