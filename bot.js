require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const express = require('express');
const auth = require('basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const CORE_CHANNEL_ID = process.env.CORE_CHANNEL_ID || '-1002340332822';
const SALES_GROUP_ID = process.env.SALES_GROUP_ID;
const CARD_NUMBER = process.env.CARD_NUMBER || "4073 4200 8249 5759 (Avazxonov S)";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '@azaayd';
const MONGODB_URI = process.env.MONGODB_URI;
const REDIS_URL = process.env.REDIS_URL;

if (!MONGODB_URI || !REDIS_URL) {
    console.error("❌ XATO: MONGODB_URI yoki REDIS_URL aniqlanmadi!");
}

// --- DATABASE SETUP ---
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // 5 soniyadan keyin timeout beradi
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB ulanishida xato:', err.message));

const userSchema = new mongoose.Schema({
    id: { type: String, unique: true, index: true },
    name: String,
    username: String,
    fullName: String,
    phone: String,
    isPaid: { type: Boolean, default: false },
    step: { type: String, default: 'START' },
    joinedAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// --- REDIS SETUP ---
const redis = new Redis(REDIS_URL);
redis.on('error', (err) => console.error('❌ Redis xatosi:', err.message));
redis.on('connect', () => console.log('🚀 Redis-ga muvaffaqiyatli ulandi!'));

// --- HELPERS ---
async function getDBUser(id, first_name, username) {
    try {
        // Avval Redisdan tekshirish
        const cachedUser = await redis.get(`user:${id}`);
        if (cachedUser) return JSON.parse(cachedUser);

        // Keyin MongoDBdan
        let user = await User.findOne({ id: String(id) });
        if (!user) {
            user = new User({
                id: String(id),
                name: first_name || "Do'st",
                username: username || '',
                step: 'START'
            });
            await user.save();
        }
        
        // Keshga yozish
        await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);
        return user;
    } catch (err) {
        console.error("getDBUser error:", err.message);
        // Xatolik bo'lsa vaqtinchalik obyekt qaytarish (bot o'chib qolmasligi uchun)
        return { id: String(id), name: first_name, step: 'ERROR' };
    }
}

async function saveUser(user) {
    try {
        if (user.save && typeof user.save === 'function') {
            await user.save();
        } else {
            await User.findOneAndUpdate({ id: user.id }, user, { upsert: true });
        }
        await redis.set(`user:${user.id}`, JSON.stringify(user), 'EX', 3600);
    } catch (err) {
        console.error("saveUser error:", err.message);
    }
}

// --- BOT LOGIC ---
const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
    const user = await getDBUser(ctx.from.id, ctx.from.first_name, ctx.from.username);
    if (!user || user.step === 'ERROR') {
        return ctx.reply("⚠️ Texnik nosozlik. Iltimos, birozdan so'ng qayta urinib ko'ring yoki adminga murojaat qiling.");
    }

    user.step = 'ASK_NAME';
    await saveUser(user);

    try {
        const fileId = process.env.START_VIDEO_ID; 
        if(fileId) await ctx.replyWithVideoNote(fileId);
    } catch (e) {
        console.log('Video note error:', e.message);
    }
    
    await ctx.reply(
        "👋 Assalomu alaykum! Siz bu yerda Instagramda kontent qiluvchilar uchun maxsus tayyorlangan 57 ta eng sara Premium Promptlarni qo'lga kiritishingiz mumkin.\n\n" +
        "👇 Iltimos, Ismingizni kiriting (Masalan: Alisher)🔥",
        { ...Markup.removeKeyboard() }
    );
});

bot.command('export', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    try {
        const users = await User.find().lean();
        let csv = "ID,Name,Username,FullName,Phone,JoinedAt,IsPaid\n";
        users.forEach(u => {
            csv += `${u.id},"${u.name}","${u.username}","${u.fullName || ''}","${u.phone || ''}",${u.joinedAt},${u.isPaid}\n`;
        });
        const fs = require('fs');
        fs.writeFileSync('users_export.csv', csv);
        await ctx.replyWithDocument({ source: 'users_export.csv', filename: 'Foydalanuvchilar_Bazasi.csv' });
    } catch (e) {
        ctx.reply("Xatolik: " + e.message);
    }
});

bot.command('admin', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    try {
        const totalUsers = await User.countDocuments();
        const paidUsers = await User.countDocuments({ isPaid: true });
        ctx.reply(`📊 Statistika\n\n👥 Jami foydalanuvchilar: ${totalUsers}\n✅ To'lov qilganlar: ${paidUsers}\n\n📥 Bazani olish: /export\n📢 Xabar yuborish: /broadcast [matn]`);
    } catch (e) {
        ctx.reply("Xatolik: " + e.message);
    }
});

bot.command('broadcast', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const msg = ctx.message.text.split(' ').slice(1).join(' ');
    if (!msg) return ctx.reply("Matn kiriting! Yozilish tartibi: /broadcast Salom hammaga");
    
    try {
        const users = await User.find().select('id').lean();
        ctx.reply(`⏳ Xabar yuborilmoqda... (${users.length} foydalanuvchiga)`);
        let success = 0;
        for (const u of users) {
            try {
                await ctx.telegram.sendMessage(u.id, msg);
                success++;
            } catch (e) {}
        }
        await ctx.reply(`✅ Xabar muvaffaqiyatli ${success} kishiga yuborildi.`);
    } catch (e) {
        ctx.reply("Xatolik: " + e.message);
    }
});

bot.on('message', async (ctx) => {
    try {
        if (ctx.message.document || ctx.message.video || ctx.message.video_note) {
            if (String(ctx.from.id) === String(ADMIN_ID)) {
                const fileId = ctx.message.document?.file_id || ctx.message.video?.file_id || ctx.message.video_note?.file_id;
                if (fileId) {
                    return ctx.reply(`ID: \`${fileId}\``, { parse_mode: 'Markdown' });
                }
            }
        }

        if (ctx.chat.type !== 'private') return;
        const user = await getDBUser(ctx.from.id, ctx.from.first_name, ctx.from.username);

        if (!user || user.step === 'ERROR') return;

        if (user.step === 'ASK_NAME' && ctx.message.text) {
            user.fullName = ctx.message.text;
            user.step = 'ASK_PHONE';
            await saveUser(user);
            await ctx.reply(`Rahmat, ${user.fullName}!\n\nRaqamingizni quyidagi tugma orqali yuboring 👇`, 
                Markup.keyboard([
                    [Markup.button.contactRequest("📱 Raqamni yuborish")]
                ]).oneTime().resize()
            );
            return;
        }

        if (user.step === 'ASK_PHONE' && (ctx.message.contact || ctx.message.text)) {
            user.phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
            user.step = 'WAIT_FOR_PAYMENT';
            await saveUser(user);
            await ctx.reply(
                `✅ Raqamingiz qabul qilindi.\n\n` +
                `🎁 57 ta Premium Promptlarni qo'lga kiritish uchun:\n\n` +
                `💳 Ushbu kartaga 57,000 so'm o'tkazing:\n` +
                `\`${CARD_NUMBER}\`\n\n` +
                `📸 So'ngra to'lov skrinshotini (chekini) shu botga rasm qilib tashlang!`,
                { parse_mode: 'Markdown', ...Markup.removeKeyboard() }
            );
            return;
        }

        if (user.step === 'WAIT_FOR_PAYMENT' && ctx.message.photo) {
            const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            await ctx.reply("⏳ Skrinshot qabul qilindi! Admin tasdiqlashini kuting. Tasdiqlangach, maxsus guruhga link beriladi.");
            await ctx.telegram.sendPhoto(SALES_GROUP_ID, photoId, {
                caption: `🔔 YANGI TO'LOV KELDI!\n\n` +
                         `👤 Mijoz: ${user.fullName} (@${user.username || 'yoq'})\n` +
                         `📞 Raqam: ${user.phone}\n` +
                         `🆔 ID: ${user.id}`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ Tasdiqlash', callback_data: `approve_${user.id}` }],
                        [{ text: '❌ Rad etish', callback_data: `reject_${user.id}` }]
                    ]
                }
            });
            return;
        }

        if (user.step === 'WAIT_FOR_PAYMENT' && ctx.message.text) {
            await ctx.reply(
                `Iltimos, to'lov skrinshotini (rasm qilib) yuboring.\n\n` +
                `💳 Karta: \`${CARD_NUMBER}\` (57,000 so'm)`,
                { parse_mode: 'Markdown', ...Markup.removeKeyboard() }
            );
        }
    } catch (e) {
        console.error("General message handler error:", e.message);
    }
});

bot.on('callback_query', async (ctx) => {
    try {
        const data = ctx.callbackQuery.data;
        if (data.startsWith('approve_') || data.startsWith('reject_')) {
            const action = data.split('_')[0];
            const targetUserId = data.split('_')[1];
            const targetUser = await User.findOne({ id: targetUserId });

            if (action === 'approve') {
                const expireDate = Math.floor(Date.now() / 1000) + 86400;
                const linkRes = await ctx.telegram.createChatInviteLink(CHANNEL_ID || CORE_CHANNEL_ID, {
                    member_limit: 1,
                    expire_date: expireDate
                });
                await ctx.telegram.sendMessage(targetUserId, 
                    `🎉 To'lovingiz tasdiqlandi, kutganingiz uchun rahmat!\n\n` +
                    `Mana sizga yopiq kanal uchun maxsus link:\n🔗 ${linkRes.invite_link}\n\n` +
                    `⚠️ Bu link faqat "BIR MARTA" ishlaydi va "24 soat" ichida kuyadi!`
                );
                if(targetUser) {
                    targetUser.isPaid = true;
                    await saveUser(targetUser);
                }
                const oldCaption = ctx.callbackQuery.message.caption || '';
                await ctx.editMessageCaption(oldCaption.replace("🔔 YANGI TO'LOV KELDI!", "✅ TASDIQLANDI"));
            } else {
                await ctx.telegram.sendMessage(targetUserId, `❌ Kechirasiz, to'lovingiz tasdiqlanmadi. Admin: ${ADMIN_USERNAME}`);
                const oldCaption = ctx.callbackQuery.message.caption || '';
                await ctx.editMessageCaption(oldCaption.replace("🔔 YANGI TO'LOV KELDI!", "❌ RAD ETILDI"));
            }
            await ctx.answerCbQuery();
        }
    } catch (e) {
        console.error("Callback query error:", e.message);
    }
});

bot.catch((err, ctx) => {
    console.log(`Botda xato: ${ctx.updateType}`, err.message);
});

// --- ADMIN DASHBOARD ---
app.get('/dashboard', async (req, res) => {
    const credentials = auth(req);
    if (!credentials || credentials.name !== '2xstat' || credentials.pass !== 'saleofprompts') {
        res.setHeader('WWW-Authenticate', 'Basic realm="example"');
        return res.status(401).send('Access denied');
    }
    try {
        const users = await User.find().sort({ joinedAt: -1 }).lean();
        const totalUsers = users.length;
        const paidUsers = users.filter(u => u.isPaid).length;
        const revenue = paidUsers * 57000;
        const conversion = totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : 0;
        let rows = '';
        users.forEach(u => {
            const date = new Date(u.joinedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
            const status = u.isPaid ? '<span class="status-badge status-paid">TO\'LOV QILDI</span>' : '<span class="status-badge status-wait">KUTMOQDA</span>';
            rows += `<tr><td>${u.id}</td><td>${u.fullName || u.name}</td><td>${u.username ? '@'+u.username : '-'}</td><td>${u.phone || '-'}</td><td>${status}</td><td>${date}</td></tr>`;
        });
        res.send(`
            <!DOCTYPE html><html><head><title>Dashboard</title>
            <style>
                body { background: #050505; color: #F3F4F6; font-family: sans-serif; padding: 20px; }
                .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                .card { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; border: 1px solid rgba(212,175,55,0.2); }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 12px; border-bottom: 1px solid #333; text-align: left; }
                .status-paid { color: #34d399; } .status-wait { color: #f87171; }
            </style></head>
            <body>
                <h1>DASHBOARD</h1>
                <div class="grid">
                    <div class="card"><h3>Jami</h3><div>${totalUsers}</div></div>
                    <div class="card"><h3>To'langan</h3><div>${paidUsers}</div></div>
                    <div class="card"><h3>Konversiya</h3><div>${conversion}%</div></div>
                    <div class="card"><h3>Daromad</h3><div>${revenue.toLocaleString()} UZS</div></div>
                </div>
                <table><thead><tr><th>ID</th><th>Ism</th><th>User</th><th>Tel</th><th>Status</th><th>Sana</th></tr></thead>
                <tbody>${rows}</tbody></table>
            </body></html>
        `);
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
bot.launch().then(() => console.log("Bot started!"));

process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
