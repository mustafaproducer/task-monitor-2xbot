const https = require('https');
const http = require('http'); 
const fs = require('fs');
const path = require('path');

// --- RENDER HEALTH CHECK ---
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running... 🤖');
}).listen(PORT, () => console.log(`Listening on ${PORT}`));

// --- CONFIG ---
const TOKEN = process.env.BOT_TOKEN || '7798199972:AAH0xSgL_RL2OGhG1RV0OHZnT53vNAlUFUc'; 
const ADMIN_ID = process.env.ADMIN_ID || '5949913506'; 
const CHANNEL_ID = process.env.CHANNEL_ID || '-1002947739734'; 
const CARD_NUMBER = process.env.CARD_NUMBER || '4073 4200 8249 5759 (Avazxonov S)';
const PRICE_TEXT = process.env.PRICE_TEXT || "Narxi: 50,000 so'm";
const DB_FILE = path.join(__dirname, 'users.json');

// --- DATABASE ---
let users = [];
try { if (fs.existsSync(DB_FILE)) users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}

function saveUser(user) {
    if (!users.find(u => u.id === user.id)) {
        users.push({ id: user.id, name: user.first_name, username: user.username, joinedAt: new Date().toISOString(), isPaid: false });
        fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
    }
}
function markAsPaid(userId) {
    const user = users.find(u => u.id == userId);
    if (user) { user.isPaid = true; user.paidAt = new Date().toISOString(); fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2)); }
}

// --- API ---
function api(method, data) {
    return new Promise((resolve, reject) => {
        const req = https.request({ hostname: 'api.telegram.org', path: `/bot${TOKEN}/${method}`, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { resolve({}); } });
        });
        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
    });
}

// --- POLLING ---
let offset = 0;
async function getUpdates() {
    try {
        const updates = await api('getUpdates', { offset, timeout: 30 });
        if (updates.result && updates.result.length > 0) {
            for (const update of updates.result) { await processUpdate(update); offset = update.update_id + 1; }
        }
    } catch (e) { console.error('Polling Error:', e.message); }
    setTimeout(getUpdates, 100); 
}

// --- LOGIC ---
async function processUpdate(update) {
    if (update.message) {
        const msg = update.message;
        const chatId = msg.chat.id;
        const text = msg.text;
        if (msg.from) saveUser(msg.from);

        // START
        if (text === '/start') {
            await api('sendMessage', {
                chat_id: chatId,
                text: `Assalomu alaykum, ${msg.from.first_name}! 👋\n\n` +
                      `🚀 **Premium Promptlar Akademiyasiga** xush kelibsiz.\n\n` +
                      `Bu yerda siz top-darajadagi sun'iy intellekt promptlarini (Midjourney, ChatGPT) topasiz.\n\n` +
                      `Nimani tanlaysiz? 👇`,
                reply_markup: {
                    keyboard: [
                        [{ text: '💎 Premium Promptlarni Sotib Olish' }],
                        [{ text: '📞 Savol berish (Admin)' }]
                    ],
                    resize_keyboard: true
                }
            });
        }
        
        // BUY
        else if (text === '💎 Premium Promptlarni Sotib Olish') {
            await api('sendMessage', {
                chat_id: chatId,
                text: `💰 **PREMIUM KANALGA KIRISH**\n\n` +
                      `💸 ${PRICE_TEXT}\n\n` +
                      `💳 Karta raqam:\n\`${CARD_NUMBER}\`\n\n` +
                      `❗️ To'lov qilgandan so'ng, chek rasmkasi (skrinshot)ni shu yerga yuboring.`,
                parse_mode: 'Markdown'
            });
        }

        // SUPPORT
        else if (text === '📞 Savol berish (Admin)') {
            await api('sendMessage', {
                chat_id: chatId,
                text: `👨‍💻 **Yordam markazi**\n\n` +
                      `Savollaringiz bo'lsa, adminga yozishingiz mumkin:\n` +
                      `@mustafaproducer`
            });
        }

        // ADMIN
        else if (text === '/admin') {
            if (String(chatId) === String(ADMIN_ID)) {
                const paidUsers = users.filter(u => u.isPaid).length;
                await api('sendMessage', {
                    chat_id: chatId,
                    text: `📊 **ADMIN STATISTIKA**\n\n` +
                          `👥 Jami foydalanuvchilar: **${users.length}** ta\n` +
                          `✅ Sotib olganlar: **${paidUsers}** ta\n` +
                          `💰 Taxminiy tushum: **${(paidUsers * 50000).toLocaleString()}** so'm\n\n` +
                          `📢 Reklama yuborish uchun:\n/broadcast [Xabar matni]`
                });
            } else {
                await api('sendMessage', { chat_id: chatId, text: `⛔️ Siz admin emassiz!\nSizning ID: \`${chatId}\``, parse_mode: 'Markdown' });
            }
        }

        // BROADCAST
        else if (text && text.startsWith('/broadcast ')) {
            if (String(chatId) === String(ADMIN_ID)) {
                const message = text.replace('/broadcast ', '');
                let count = 0;
                await api('sendMessage', { chat_id: chatId, text: `⏳ Xabar yuborish boshlandi...` });
                for (const user of users) {
                    try { await api('sendMessage', { chat_id: user.id, text: message }); count++; } catch (e) {}
                }
                await api('sendMessage', { chat_id: chatId, text: `✅ Xabar **${count}** ta foydalanuvchiga yuborildi!` });
            }
        }

        // PHOTO (PAYMENT)
        else if (msg.photo) {
            await api('sendMessage', { chat_id: chatId, text: "✅ Skrinshot qabul qilindi! Admin tasdiqlashini kuting. Tez orada javob beramiz. ⏳" });
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            await api('sendPhoto', {
                chat_id: ADMIN_ID,
                photo: photoId,
                caption: `🔔 **YANGI TO'LOV!**\n\n👤 Kimdan: ${msg.from.first_name} (ID: ${msg.from.id})`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: `approve_${chatId}` }, { text: '❌ Rad etish', callback_data: `reject_${chatId}` }]]
                }
            });
        }
    }

    // CALLBACK QUERY
    if (update.callback_query) {
        const cq = update.callback_query;
        const data = cq.data;
        const adminChatId = cq.message.chat.id;
        const msgId = cq.message.message_id;

        if (data.startsWith('approve_')) {
            const userId = data.split('_')[1];
            try {
                const expireDate = Math.floor(Date.now() / 1000) + 86400; 
                const linkRes = await api('createChatInviteLink', { chat_id: CHANNEL_ID, member_limit: 1, expire_date: expireDate });
                
                if (linkRes.ok && linkRes.result) {
                    const inviteLink = linkRes.result.invite_link;
                    await api('sendMessage', { chat_id: userId, text: `🎉 **To'lov tasdiqlandi!** Rahmat.\n\nMaxsus Link:\n${inviteLink}\n\n⚠️ Bu link faqat **BIR MARTA** ishlaydi va **24 soat** ichida kuyadi!` });
                    markAsPaid(userId);
                    await api('editMessageCaption', { chat_id: adminChatId, message_id: msgId, caption: `✅ **TASDIQLANDI**\n\nLink yuborildi:\n${inviteLink}` });
                } else {
                    await api('sendMessage', { chat_id: adminChatId, text: `❌ Link xatosi: ${JSON.stringify(linkRes)}` });
                }
            } catch (e) { console.error('Link Error:', e); }
        } else if (data.startsWith('reject_')) {
            const userId = data.split('_')[1];
            await api('sendMessage', { chat_id: userId, text: "❌ Kechirasiz, to'lovingiz tasdiqlanmadi. Admin bilan bog'laning." });
            await api('editMessageCaption', { chat_id: adminChatId, message_id: msgId, caption: `❌ **RAD ETILDI**` });
        }
        await api('answerCallbackQuery', { callback_query_id: cq.id });
    }
}

getUpdates();
