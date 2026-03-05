const https = require('https');
const http = require('http'); // HTTP modul qo'shildi
const fs = require('fs');
const path = require('path');

// --- RENDER HEALTH CHECK (Port tinglash) ---
// Render botni "Web Service" deb o'ylagani uchun, biz unga port ochib beramiz.
// Aks holda u 10 daqiqadan keyin "Port ochilmadi" deb botni o'chirib qo'yadi.
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running... 🤖');
}).listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// --- SOZLAMALAR ---
const TOKEN = process.env.BOT_TOKEN || '7798199972:AAH0xSgL_RL2OGhG1RV0OHZnT53vNAlUFUc'; 
const ADMIN_ID = process.env.ADMIN_ID || '5949913506'; 
const CHANNEL_ID = process.env.CHANNEL_ID || '-1002947739734'; 
const CARD_NUMBER = process.env.CARD_NUMBER || '4073 4200 8249 5759 (Avazxonov S)';
const PRICE_TEXT = process.env.PRICE_TEXT || "Narxi: 50,000 so'm";

// Cloud da fayl yo'qolib qolmasligi uchun (Persistent Disk bo'lmasa)
// Railway/Render da fayl yozish muammoli bo'lishi mumkin, lekin kichik bot uchun ishlaydi
const DB_FILE = path.join(__dirname, 'users.json');

// --- DATABASE (Users & Stats) ---
let users = [];
try {
    if (fs.existsSync(DB_FILE)) {
        users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
} catch (e) {
    console.error('Database Error:', e);
}

function saveUser(user) {
    if (!users.find(u => u.id === user.id)) {
        users.push({
            id: user.id,
            name: user.first_name,
            username: user.username,
            joinedAt: new Date().toISOString(),
            isPaid: false
        });
        fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
    }
}

function markAsPaid(userId) {
    const user = users.find(u => u.id == userId);
    if (user) {
        user.isPaid = true;
        user.paidAt = new Date().toISOString();
        fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
    }
}

// --- API HELPER ---
function api(method, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${TOKEN}/${method}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    // console.error('JSON Error:', body);
                    resolve({});
                }
            });
        });

        req.on('error', (e) => {
            console.error(`Problem with request: ${e.message}`);
            reject(e);
        });

        req.write(JSON.stringify(data));
        req.end();
    });
}

// --- LONG POLLING ---
let offset = 0;

async function getUpdates() {
    try {
        const updates = await api('getUpdates', { offset, timeout: 30 });
        if (updates.result && updates.result.length > 0) {
            for (const update of updates.result) {
                await processUpdate(update);
                offset = update.update_id + 1;
            }
        }
    } catch (e) {
        console.error('Polling Error:', e.message);
    }
    setTimeout(getUpdates, 100); 
}

// --- LOGIC ---
async function processUpdate(update) {
    // 1. Message
    if (update.message) {
        const msg = update.message;
        const chatId = msg.chat.id;
        const text = msg.text;

        // Save User
        if (msg.from) saveUser(msg.from);

        // --- COMMANDS ---

        // Start
        if (text === '/start') {
            await api('sendMessage', {
                chat_id: chatId,
                text: `Assalomu alaykum, ${msg.from.first_name}! 👋\n\n` +
                      `🚀 **Premium Promptlar Akademiyasiga** xush kelibsiz.\n\n` +
                      `Bu yerda siz top-darajadagi sun'iy intellekt promptlarini (Midjourney, ChatGPT) topasiz.\n\n` +
                      `Nimani tanlaysiz? 👇`,
                reply_markup: {
                    keyboard: [
                        [{ text: '💎 Sotib olish (Premium)' }, { text: '📂 Namuna (Demo)' }],
                        [{ text: '📞 Admin bilan bog\'lanish' }]
                    ],
                    resize_keyboard: true
                }
            });
        }
        
        // Admin Panel (DEBUG FIXED)
        else if (text === '/admin') {
            // Admin ID ni stringga o'tkazib tekshiramiz (xavfsizlik uchun)
            if (String(chatId) === String(ADMIN_ID)) {
                const totalUsers = users.length;
                const paidUsers = users.filter(u => u.isPaid).length;
                const totalRevenue = paidUsers * 50000; 

                await api('sendMessage', {
                    chat_id: chatId,
                    text: `📊 **ADMIN STATISTIKA**\n\n` +
                          `👥 Jami foydalanuvchilar: **${totalUsers}** ta\n` +
                          `✅ Sotib olganlar: **${paidUsers}** ta\n` +
                          `💰 Taxminiy tushum: **${totalRevenue.toLocaleString()}** so'm\n\n` +
                          `📢 Reklama yuborish uchun:\n` +
                          `/broadcast [Xabar matni]`
                });
            } else {
                // Agar ID to'g'ri kelmasa
                await api('sendMessage', {
                    chat_id: chatId,
                    text: `⛔️ Siz admin emassiz!\nSizning ID: \`${chatId}\`\nAdmin ID: \`${ADMIN_ID}\``,
                    parse_mode: 'Markdown'
                });
            }
        }

        // Broadcast
        else if (text && text.startsWith('/broadcast ')) {
            if (String(chatId) === String(ADMIN_ID)) {
                const message = text.replace('/broadcast ', '');
                let count = 0;
                
                await api('sendMessage', { chat_id: chatId, text: `⏳ Xabar yuborish boshlandi...` });

                for (const user of users) {
                    try {
                        await api('sendMessage', { chat_id: user.id, text: message });
                        count++;
                    } catch (e) {
                        console.error(`Failed to send to ${user.id}`);
                    }
                }

                await api('sendMessage', { chat_id: chatId, text: `✅ Xabar **${count}** ta foydalanuvchiga yuborildi!` });
            }
        }

        // --- BUTTONS ---

        // Buy
        else if (text === '💎 Sotib olish (Premium)') {
            await api('sendMessage', {
                chat_id: chatId,
                text: `💰 **PREMIUM KANALGA KIRISH**\n\n` +
                      `💸 ${PRICE_TEXT}\n\n` +
                      `💳 Karta raqam:\n\`${CARD_NUMBER}\`\n\n` +
                      `❗️ To'lov qilgandan so'ng, chek rasmkasi (skrinshot)ni shu yerga yuboring.`,
                parse_mode: 'Markdown'
            });
        }

        // Demo
        else if (text === '📂 Namuna (Demo)') {
            await api('sendMessage', {
                chat_id: chatId,
                text: `🎨 **Bepul Prompt namunasi:**\n\n` +
                      `Prompt: "Hyper-realistic portrait of an astronaut on Mars, cinematic lighting, 8k resolution, detailed texture"\n\n` +
                      `💡 Bu kabi 50+ premium promptlar faqat yopiq kanalda!\n` +
                      `Sotib olish uchun "💎 Sotib olish" tugmasini bosing.`
            });
        }

        // Support
        else if (text === '📞 Admin bilan bog\'lanish') {
            await api('sendMessage', {
                chat_id: chatId,
                text: `👨‍💻 **Yordam markazi**\n\n` +
                      `Savollaringiz bo'lsa, adminga yozishingiz mumkin:\n` +
                      `@mustafaproducer` 
            });
        }

        // Photo (Screenshot)
        else if (msg.photo) {
            // Test uchun admin check olib tashlandi
            // if (chatId === ADMIN_ID) return; 

            await api('sendMessage', {
                chat_id: chatId,
                text: "✅ Skrinshot qabul qilindi! Admin tasdiqlashini kuting. Tez orada javob beramiz. ⏳"
            });

            // Send to Admin
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            const caption = `🔔 **YANGI TO'LOV!**\n\n` +
                            `👤 Kimdan: ${msg.from.first_name} (ID: ${msg.from.id})\n` +
                            `Agar tasdiqlasangiz, tugmani bosing 👇`;
            
            await api('sendPhoto', {
                chat_id: ADMIN_ID,
                photo: photoId,
                caption: caption,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Tasdiqlash', callback_data: `approve_${chatId}` },
                            { text: '❌ Rad etish', callback_data: `reject_${chatId}` }
                        ]
                    ]
                }
            });
        }
    }

    // 2. Callback Query (Buttons)
    if (update.callback_query) {
        const cq = update.callback_query;
        const data = cq.data;
        const adminChatId = cq.message.chat.id;
        const msgId = cq.message.message_id;

        if (data.startsWith('approve_')) {
            const userId = data.split('_')[1];
            
            let inviteLink = 'Xatolik yuz berdi. Admin bilan bog\'laning.';
            
            try {
                // Link: 1 kishi, 24 soat expire
                const expireDate = Math.floor(Date.now() / 1000) + 86400; // +1 day

                const linkRes = await api('createChatInviteLink', {
                    chat_id: CHANNEL_ID, 
                    member_limit: 1, 
                    expire_date: expireDate
                });
                
                if (linkRes.ok && linkRes.result) {
                    inviteLink = linkRes.result.invite_link;
                    
                    // Userga yuborish
                    await api('sendMessage', {
                        chat_id: userId,
                        text: `🎉 **To'lov tasdiqlandi!** Rahmat.\n\n` +
                              `Mana siz uchun MAXSUS Link:\n` +
                              `${inviteLink}\n\n` +
                              `⚠️ Eslatma: Bu link faqat **BIR MARTA** ishlaydi va **24 soat** ichida kuyadi!\n` +
                              `Iltimos, hoziroq qo'shilib oling!`
                    });

                    // Bazada to'langan deb belgilash
                    markAsPaid(userId);

                    // Admin update
                    await api('editMessageCaption', {
                        chat_id: adminChatId,
                        message_id: msgId,
                        caption: `✅ **TASDIQLANDI**\n\nUserga link yuborildi:\n${inviteLink}`
                    });

                } else {
                    console.error('Link generation failed:', linkRes);
                    await api('sendMessage', { chat_id: adminChatId, text: `❌ Link yaratib bo'lmadi! Xatolik: ${JSON.stringify(linkRes)}` });
                }

            } catch (e) {
                console.error('Link Error:', e);
            }
        }
        
        else if (data.startsWith('reject_')) {
            const userId = data.split('_')[1];
            
            await api('sendMessage', {
                chat_id: userId,
                text: "❌ Kechirasiz, to'lovingiz tasdiqlanmadi. Iltimos, admin bilan bog'laning."
            });

            await api('editMessageCaption', {
                chat_id: adminChatId,
                message_id: msgId,
                caption: `❌ **RAD ETILDI**`
            });
        }

        await api('answerCallbackQuery', { callback_query_id: cq.id });
    }
}

console.log('🤖 Bot (Final V2.0 - Fixed Admin) ishga tushdi...');
getUpdates();
