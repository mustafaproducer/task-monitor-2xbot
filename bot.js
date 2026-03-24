require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const express = require('express');
const auth = require('basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const config = {
    token: process.env.BOT_TOKEN,
    adminId: String(process.env.ADMIN_ID),
    channelId: process.env.CHANNEL_ID,
    coreChannelId: process.env.CORE_CHANNEL_ID || '-1002340332822',
    salesGroupId: process.env.SALES_GROUP_ID,
    cardNumber: process.env.CARD_NUMBER || "4073 4200 8249 5759 (Avazxonov S)",
    adminUsername: process.env.ADMIN_USERNAME || '@azaayd',
    mongoUri: process.env.MONGODB_URI,
    redisUrl: process.env.REDIS_URL
};

// --- DATABASE SETUP ---
mongoose.connect(config.mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

const User = mongoose.model('User', new mongoose.Schema({
    id: { type: String, unique: true, index: true },
    name: String,
    username: String,
    fullName: String,
    phone: String,
    isPaid: { type: Boolean, default: false },
    step: { type: String, default: 'START' },
    joinedAt: { type: Date, default: Date.now }
}));

// --- REDIS SETUP ---
const redis = new Redis(config.redisUrl);
redis.on('error', (err) => console.error('❌ Redis Error:', err.message));
redis.on('connect', () => console.log('🚀 Connected to Redis'));

// --- CORE FUNCTIONS ---
async function getDBUser(ctx) {
    const id = String(ctx.from.id);
    try {
        const cachedUser = await redis.get(`user:${id}`);
        if (cachedUser) return JSON.parse(cachedUser);

        let user = await User.findOne({ id });
        if (!user) {
            user = new User({
                id,
                name: ctx.from.first_name || "Do'st",
                username: ctx.from.username || '',
                step: 'START'
            });
            await user.save();
        }
        await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);
        return user.toObject ? user.toObject() : user;
    } catch (err) {
        console.error("getDBUser Error:", err.message);
        return { id, name: ctx.from.first_name, step: 'START' };
    }
}

async function saveUser(user) {
    try {
        await User.findOneAndUpdate({ id: user.id }, user, { upsert: true });
        await redis.set(`user:${user.id}`, JSON.stringify(user), 'EX', 3600);
    } catch (err) {
        console.error("saveUser Error:", err.message);
    }
}

// --- BOT HANDLERS ---
const bot = new Telegraf(config.token);

bot.start(async (ctx) => {
    const user = await getDBUser(ctx);
    user.step = 'ASK_NAME';
    await saveUser(user);

    try {
        const fileId = process.env.START_VIDEO_ID; 
        if(fileId) await ctx.replyWithVideoNote(fileId);
    } catch (e) { console.log('VideoNote skip') }
    
    await ctx.reply(
        "👋 Assalomu alaykum! Siz bu yerda Instagramda kontent qiluvchilar uchun maxsus tayyorlangan 57 ta eng sara Premium Promptlarni qo'lga kiritishingiz mumkin.\n\n" +
        "👇 Iltimos, Ismingizni kiriting (Masalan: Alisher)🔥",
        Markup.removeKeyboard()
    );
});

bot.command('admin', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;
    const total = await User.countDocuments();
    const paid = await User.countDocuments({ isPaid: true });
    ctx.reply(`📊 Statistika\n\n👥 Jami: ${total}\n✅ To'laganlar: ${paid}\n\n📥 /export\n📢 /broadcast [text]`);
});

bot.command('export', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;
    const users = await User.find().lean();
    let csv = "ID,Name,Username,FullName,Phone,IsPaid\n";
    users.forEach(u => {
        csv += `${u.id},"${u.name}","${u.username}","${u.fullName || ''}","${u.phone || ''}",${u.isPaid}\n`;
    });
    require('fs').writeFileSync('export.csv', csv);
    await ctx.replyWithDocument({ source: 'export.csv' });
});

bot.command('broadcast', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;
    const msg = ctx.message.text.split(' ').slice(1).join(' ');
    if (!msg) return ctx.reply("Matn?");
    const users = await User.find().select('id').lean();
    ctx.reply(`⏳ Yuborilmoqda: ${users.length} ta`);
    for (const u of users) {
        try { await bot.telegram.sendMessage(u.id, msg); } catch (e) {}
    }
    ctx.reply("✅ Tayyor");
});

bot.on('message', async (ctx) => {
    // Admin check for File IDs
    if (String(ctx.from.id) === config.adminId && (ctx.message.document || ctx.message.video || ctx.message.video_note)) {
        const fid = ctx.message.document?.file_id || ctx.message.video?.file_id || ctx.message.video_note?.file_id;
        return ctx.reply(`ID: \`${fid}\``, { parse_mode: 'Markdown' });
    }

    if (ctx.chat.type !== 'private') return;
    const user = await getDBUser(ctx);

    if (user.step === 'ASK_NAME' && ctx.message.text) {
        user.fullName = ctx.message.text;
        user.step = 'ASK_PHONE';
        await saveUser(user);
        return ctx.reply(`Rahmat, ${user.fullName}!\n\nRaqamingizni pastdagi tugma orqali yuboring 👇`, 
            Markup.keyboard([[Markup.button.contactRequest("📱 Raqamni yuborish")]]).oneTime().resize()
        );
    }

    if (user.step === 'ASK_PHONE' && (ctx.message.contact || ctx.message.text)) {
        user.phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
        user.step = 'WAIT_FOR_PAYMENT';
        await saveUser(user);
        return ctx.reply(
            `✅ Raqamingiz qabul qilindi.\n\n` +
            `🎁 57 ta Premium Promptlarni qo'lga kiritish uchun:\n\n` +
            `💳 Ushbu kartaga 57,000 so'm o'tkazing:\n` +
            `\`${config.cardNumber}\`\n\n` +
            `📸 So'ngra to'lov skrinshotini (chekini) rasm qilib yuboring!`,
            { parse_mode: 'Markdown', ...Markup.removeKeyboard() }
        );
    }

    if (user.step === 'WAIT_FOR_PAYMENT' && ctx.message.photo) {
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        await ctx.reply("⏳ Skrinshot qabul qilindi! Admin tasdiqlashini kuting.");
        return ctx.telegram.sendPhoto(config.salesGroupId, photoId, {
            caption: `🔔 *YANGI TO'LOV*\n\n👤: ${user.fullName} (@${user.username || 'yoq'})\n📞: ${user.phone}\n🆔: ${user.id}`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Tasdiqlash', callback_data: `approve_${user.id}` }],
                    [{ text: '❌ Rad etish', callback_data: `reject_${user.id}` }]
                ]
            }
        });
    }

    if (user.step === 'WAIT_FOR_PAYMENT' && ctx.message.text) {
        return ctx.reply(`Iltimos, to'lov skrinshotini rasm qilib yuboring.\n\n💳 Karta: \`${config.cardNumber}\` (57,000 so'm)`, { parse_mode: 'Markdown' });
    }
});

bot.on('callback_query', async (ctx) => {
    const [action, uid] = ctx.callbackQuery.data.split('_');
    const targetUser = await User.findOne({ id: uid });

    if (action === 'approve') {
        try {
            const link = await ctx.telegram.createChatInviteLink(config.channelId || config.coreChannelId, { member_limit: 1, expire_date: Math.floor(Date.now()/1000)+86400 });
            await ctx.telegram.sendMessage(uid, `🎉 To'lovingiz tasdiqlandi!\n\n🔗 Havola: ${link.invite_link}\n\n⚠️ Faqat bir marta ishlaydi!`);
            if (targetUser) { targetUser.isPaid = true; await targetUser.save(); await redis.del(`user:${uid}`); }
            await ctx.editMessageCaption(ctx.callbackQuery.message.caption.replace("🔔 YANGI TO'LOV", "✅ TASDIQLANDI"));
        } catch (e) { await ctx.answerCbQuery("Xatolik! Bot adminmi?"); }
    } else if (action === 'reject') {
        await ctx.telegram.sendMessage(uid, `❌ To'lov tasdiqlanmadi. Admin: ${config.adminUsername}`);
        await ctx.editMessageCaption(ctx.callbackQuery.message.caption.replace("🔔 YANGI TO'LOV", "❌ RAD ETILDI"));
    }
    await ctx.answerCbQuery();
});

// --- ADMIN DASHBOARD ---
app.get('/dashboard', async (req, res) => {
    const creds = auth(req);
    if (!creds || creds.name !== '2xstat' || creds.pass !== 'saleofprompts') {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
        return res.status(401).send('Access denied');
    }
    try {
        const users = await User.find().sort({ joinedAt: -1 }).limit(100).lean();
        const total = await User.countDocuments();
        const paid = await User.countDocuments({ isPaid: true });
        let rows = users.map(u => `<tr><td>${u.id}</td><td>${u.fullName || u.name}</td><td>${u.username}</td><td>${u.phone}</td><td>${u.isPaid ? '✅' : '⏳'}</td><td>${new Date(u.joinedAt).toLocaleString()}</td></tr>`).join('');
        res.send(`<html><body style="background:#000;color:#fff;font-family:sans-serif;"><h2>STATISTIKA</h2><p>Jami: ${total} | To'lov: ${paid}</p><table border="1" style="width:100%; border-collapse:collapse;"><tr><th>ID</th><th>Ism</th><th>User</th><th>Tel</th><th>Holat</th><th>Sana</th></tr>${rows}</table></body></html>`);
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
