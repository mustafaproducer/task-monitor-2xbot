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

// --- DATABASE SETUP ---
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('✅ MongoDB connected'))
        .catch(err => console.error('❌ MongoDB error:', err));
}

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
let redis;
if (REDIS_URL) {
    redis = new Redis(REDIS_URL);
    redis.on('error', (err) => console.error('❌ Redis error:', err.message));
    redis.on('connect', () => console.log('🚀 Redis connected'));
}

// --- HELPERS ---
async function getDBUser(id, first_name, username) {
    try {
        if (redis) {
            const cachedUser = await redis.get(`user:${id}`);
            if (cachedUser) return JSON.parse(cachedUser);
        }

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
        
        if (redis) await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);
        return user;
    } catch (err) {
        console.error("getDBUser error:", err.message);
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
        if (redis) await redis.set(`user:${user.id}`, JSON.stringify(user), 'EX', 3600);
    } catch (err) {
        console.error("saveUser error:", err.message);
    }
}

// --- BOT LOGIC ---
const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
    const user = await getDBUser(ctx.from.id, ctx.from.first_name, ctx.from.username);
    if (!user || user.step === 'ERROR') {
        return ctx.reply("⚠️ Texnik nosozlik. Iltimos, birozdan so'ng qayta urinib ko'ring.");
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
                if (fileId) return ctx.reply(`ID: \`${fileId}\``, { parse_mode: 'Markdown' });
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
                Markup.keyboard([[Markup.button.contactRequest("📱 Raqamni yuborish")]]).oneTime().resize()
            );
            return;
        }

        if (user.step === 'ASK_PHONE' && (ctx.message.contact || ctx.message.text)) {
            user.phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
            user.step = 'WAIT_FOR_PAYMENT';
            await saveUser(user);
            await ctx.reply(
                `✅ Raqamingiz qabul qilindi.\n\n🎁 57 ta Premium Promptlarni qo'lga kiritish uchun:\n\n💳 Ushbu kartaga 57,000 so'm o'tkazing:\n\`${CARD_NUMBER}\`\n\n📸 So'ngra to'lov skrinshotini (chekini) rasm qilib yuboring!`,
                { parse_mode: 'Markdown', ...Markup.removeKeyboard() }
            );
            return;
        }

        if (user.step === 'WAIT_FOR_PAYMENT' && ctx.message.photo) {
            const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            await ctx.reply("⏳ Skrinshot qabul qilindi! Admin tasdiqlashini kuting.");
            await ctx.telegram.sendPhoto(SALES_GROUP_ID, photoId, {
                caption: `🔔 YANGI TO'LOV KELDI!\n\n👤 Mijoz: ${user.fullName} (@${user.username || 'yoq'})\n📞 Raqam: ${user.phone}\n🆔 ID: ${user.id}`,
                padding: 'Markdown',
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
            await ctx.reply(`Iltimos, to'lov skrinshotini rasm qilib yuboring.\n\n💳 Karta: \`${CARD_NUMBER}\` (57,000 so'm)`, { parse_mode: 'Markdown' });
        }
    } catch (e) { console.error("Msg Error:", e.message); }
});

bot.on('callback_query', async (ctx) => {
    try {
        const data = ctx.callbackQuery.data;
        const [action, targetUserId] = data.split('_');
        const targetUser = await User.findOne({ id: targetUserId });

        if (action === 'approve') {
            const expireDate = Math.floor(Date.now() / 1000) + 86400;
            const linkRes = await ctx.telegram.createChatInviteLink(CHANNEL_ID || CORE_CHANNEL_ID, { member_limit: 1, expire_date: expireDate });
            await ctx.telegram.sendMessage(targetUserId, `🎉 To'lovingiz tasdiqlandi!\n\n🔗 Havola: ${linkRes.invite_link}\n\n⚠️ Faqat bir marta ishlaydi!`);
            if(targetUser) { targetUser.isPaid = true; await saveUser(targetUser); }
            await ctx.editMessageCaption(ctx.callbackQuery.message.caption.replace("🔔 YANGI TO'LOV KELDI!", "✅ TASDIQLANDI"));
        } else {
            await ctx.telegram.sendMessage(targetUserId, `❌ Kechirasiz, to'lovingiz tasdiqlanmadi. Admin: ${ADMIN_USERNAME}`);
            await ctx.editMessageCaption(ctx.callbackQuery.message.caption.replace("🔔 YANGI TO'LOV KELDI!", "❌ RAD ETILDI"));
        }
        await ctx.answerCbQuery();
    } catch (e) { console.error("CB Error:", e.message); }
});

app.get('/dashboard', async (req, res) => {
    const credentials = auth(req);
    if (!credentials || credentials.name !== '2xstat' || credentials.pass !== 'saleofprompts') {
        res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
        return res.status(401).send('Access denied');
    }
    try {
        const users = await User.find().sort({ joinedAt: -1 }).lean();
        const totalUsers = users.length;
        const paidUsers = users.filter(u => u.isPaid).length;
        const revenue = paidUsers * 57000;
        const conversion = totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : 0;
        let rows = users.map(u => `<tr><td>${u.id}</td><td>${u.fullName || u.name}</td><td>${u.username ? '@'+u.username : '-'}</td><td>${u.phone || '-'}</td><td>${u.isPaid ? 'OK' : 'WAIT'}</td><td>${new Date(u.joinedAt).toLocaleString()}</td></tr>`).join('');
        res.send(`<html><body style="background:#111;color:#fff;font-family:sans-serif;"><h1>DASHBOARD</h1><p>Users: ${totalUsers} | Paid: ${paidUsers} | Rev: ${revenue} UZS</p><table border="1">${rows}</table></body></html>`);
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
bot.launch();
