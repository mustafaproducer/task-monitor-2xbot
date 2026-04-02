require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const express = require('express');

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
    adminUsername: process.env.ADMIN_USERNAME || '@usmon_2xadmin',
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
    redisUrl: process.env.REDIS_URL
};

// --- DATABASE SETUP ---
console.log('⏳ Connecting to Supabase...');
const supabase = createClient(config.supabaseUrl, config.supabaseKey);
console.log('✅ Supabase client ready');

// --- REDIS SETUP ---
const redis = new Redis(config.redisUrl);
redis.on('error', (err) => console.error('❌ Redis Error:', err.message));
redis.on('connect', () => console.log('🚀 Connected to Redis'));

// --- CORE FUNCTIONS ---
async function getDBUser(ctx) {
    const id = String(ctx.from.id);
    try {
        let cachedUser = null;
        try {
            cachedUser = await Promise.race([
                redis.get(`user:${id}`),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);
        } catch (re) {
            console.error("Redis Get Error (falling back to DB):", re.message);
        }

        if (cachedUser) return JSON.parse(cachedUser);

        let { data: user } = await supabase.from('users').select('*').eq('id', id).maybeSingle();

        if (!user) {
            const { data: newUser } = await supabase.from('users').insert({
                id,
                name: ctx.from.first_name || "Do'st",
                username: ctx.from.username || '',
                step: 'START'
            }).select().single();
            user = newUser;
        }

        try {
            await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);
        } catch (se) {}

        return user;
    } catch (err) {
        console.error("getDBUser Error:", err.message);
        return { id, name: ctx.from.first_name, step: 'START' };
    }
}

async function saveUser(user) {
    try {
        await supabase.from('users').upsert({
            id: user.id,
            name: user.name,
            username: user.username,
            full_name: user.full_name,
            phone: user.phone,
            is_paid: user.is_paid,
            step: user.step
        }, { onConflict: 'id' });
        try {
            await redis.set(`user:${user.id}`, JSON.stringify(user), 'EX', 3600);
        } catch (se) {}
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
        if (fileId) await ctx.replyWithVideoNote(fileId);
    } catch (e) { console.log('VideoNote skip') }

    await ctx.reply(
        "👋 Assalomu alaykum! Siz bu yerda Instagramda kontent qiluvchilar uchun maxsus tayyorlangan 57 ta eng sara Premium Promptlarni qo'lga kiritishingiz mumkin.\n\n" +
        "👇 Iltimos, Ismingizni kiriting (Masalan: Alisher)🔥",
        Markup.removeKeyboard()
    );
});

bot.command('admin', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;
    const { count: total } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: paid } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_paid', true);
    ctx.reply(`📊 Statistika\n\n👥 Jami: ${total}\n✅ To'laganlar: ${paid}\n\n📥 /export\n📢 /broadcast [text]`);
});

bot.command('export', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;
    const { data: users } = await supabase.from('users').select('*');
    let csv = "ID,Name,Username,FullName,Phone,IsPaid\n";
    users.forEach(u => {
        csv += `${u.id},"${u.name}","${u.username}","${u.full_name || ''}","${u.phone || ''}",${u.is_paid}\n`;
    });
    require('fs').writeFileSync('export.csv', csv);
    await ctx.replyWithDocument({ source: 'export.csv' });
});

bot.command('broadcast', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;
    const msg = ctx.message.text.split(' ').slice(1).join(' ');
    if (!msg) return ctx.reply("Matn?");
    const { data: users } = await supabase.from('users').select('id');
    ctx.reply(`⏳ Yuborilmoqda: ${users.length} ta`);
    for (const u of users) {
        try { await bot.telegram.sendMessage(u.id, msg); } catch (e) {}
    }
    ctx.reply("✅ Tayyor");
});

bot.on('message', async (ctx) => {
    if (String(ctx.from.id) === config.adminId && (ctx.message.document || ctx.message.video || ctx.message.video_note)) {
        const fid = ctx.message.document?.file_id || ctx.message.video?.file_id || ctx.message.video_note?.file_id;
        return ctx.reply(`ID: \`${fid}\``, { parse_mode: 'Markdown' });
    }

    if (ctx.chat.type !== 'private') return;
    const user = await getDBUser(ctx);

    if (user.step === 'ASK_NAME' && ctx.message.text) {
        user.full_name = ctx.message.text;
        user.step = 'ASK_PHONE';
        await saveUser(user);
        return ctx.reply(`Rahmat, ${user.full_name}!\n\nRaqamingizni pastdagi tugma orqali yuboring 👇`,
            Markup.keyboard([[Markup.button.contactRequest("📱 Raqamni yuborish")]]).oneTime().resize()
        );
    }

    if (user.step === 'ASK_PHONE' && (ctx.message.contact || ctx.message.text)) {
        user.phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
        user.step = 'WAIT_FOR_PAYMENT';
        await saveUser(user);
        return ctx.replyWithPhoto(
            { source: 'poster.png' },
            {
                caption: `✅ Raqamingiz qabul qilindi.\n\n` +
                         `🎁 57 ta Premium Promptlarni qo'lga kiritish uchun:\n\n` +
                         `💳 Ushbu kartaga 57,000 so'm o'tkazing:\n` +
                         `\`${config.cardNumber}\`\n\n` +
                         `📸 So'ngra to'lov skrinshotini (chekini) rasm qilib yuboring!\n\n` +
                         `♻️ Boshidan boshlash uchun /start buyrug'ini bosing.`,
                parse_mode: 'Markdown',
                ...Markup.removeKeyboard()
            }
        );
    }

    if (user.step === 'WAIT_FOR_PAYMENT' && ctx.message.photo) {
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

        const adminUser = config.adminUsername ? config.adminUsername.replace('@', '') : 'admin';
        await ctx.reply("⏳ Skrinshot qabul qilindi! Admin tasdiqlashini kuting.", {
            reply_markup: {
                inline_keyboard: [[{ text: "👨‍💻 Admin bilan bog'lanish", url: `https://t.me/${adminUser}` }]]
            }
        });

        return ctx.telegram.sendPhoto(config.salesGroupId, photoId, {
            caption: `🔔 *YANGI TO'LOV*\n\n👤: ${user.full_name} (@${user.username || 'yoq'})\n📞: ${user.phone}\n🆔: ${user.id}`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Tasdiqlash', callback_data: `approve_${user.id}` },
                        { text: '❌ Rad etish', callback_data: `reject_${user.id}` }
                    ]
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
    const { data: targetUser } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();

    if (action === 'approve') {
        try {
            const link = await ctx.telegram.createChatInviteLink(config.channelId || config.coreChannelId, { member_limit: 1, expire_date: Math.floor(Date.now() / 1000) + 86400 });
            await ctx.telegram.sendMessage(uid, `🎉 To'lovingiz tasdiqlandi!\n\n🔗 Havola: ${link.invite_link}\n\n⚠️ Faqat bir marta ishlaydi!`);
            if (targetUser) {
                await supabase.from('users').update({ is_paid: true }).eq('id', uid);
                await redis.del(`user:${uid}`);
            }
            await ctx.editMessageCaption(ctx.callbackQuery.message.caption.replace("🔔 YANGI TO'LOV", "✅ TASDIQLANDI"));
            await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        } catch (e) { await ctx.answerCbQuery("Xatolik! Bot adminmi?"); }
    } else if (action === 'reject') {
        await ctx.telegram.sendMessage(uid, `❌ To'lov tasdiqlanmadi. Admin: ${config.adminUsername}`);
        await ctx.editMessageCaption(ctx.callbackQuery.message.caption.replace("🔔 YANGI TO'LOV", "❌ RAD ETILDI"));
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    }
    await ctx.answerCbQuery();
});

// --- ADMIN DASHBOARD ---
const cookieParser = require('cookie-parser');
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const DASHBOARD_USER = process.env.DASHBOARD_USER || '2xstat';
const DASHBOARD_PASS = process.env.DASHBOARD_PASS || 'saleofprompts';
const AUTH_TOKEN = 'secret_2x_premium_token';

function checkAuth(req, res, next) {
    if (req.cookies.auth === AUTH_TOKEN) return next();
    res.redirect('/login');
}

app.get('/login', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html><head><title>Admin Panel | Login</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { background: #050505; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: rgba(20, 20, 22, 0.6); backdrop-filter: blur(20px); padding: 40px; border-radius: 20px; border: 1px solid rgba(212, 175, 55, 0.15); box-shadow: 0 15px 35px rgba(0,0,0,0.5); text-align: center; width: 100%; max-width: 360px; }
        h2 { color: #D4AF37; margin-bottom: 30px; letter-spacing: 2px; font-weight: 600; text-transform: uppercase; }
        input { width: 100%; padding: 14px; margin-bottom: 20px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 12px; box-sizing: border-box; outline: none; font-size: 16px; transition: 0.3s; }
        input:focus { border-color: #D4AF37; box-shadow: 0 0 10px rgba(212,175,55,0.2); }
        button { width: 100%; padding: 14px; background: linear-gradient(135deg, #D4AF37, #AA8222); color: #000; border: none; border-radius: 12px; font-weight: 700; font-size: 16px; cursor: pointer; }
    </style></head><body>
        <div class="card">
            <h2>ADMIN PANEL</h2>
            <form method="POST" action="/login">
                <input type="text" name="username" placeholder="Login" required>
                <input type="password" name="password" placeholder="Parol" required>
                <button type="submit">KIRISH</button>
            </form>
        </div>
    </body></html>
    `);
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === DASHBOARD_USER && password === DASHBOARD_PASS) {
        res.cookie('auth', AUTH_TOKEN, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true });
        res.redirect('/dashboard');
    } else {
        res.send("<script>alert('Login yoki parol xato!'); window.location.href='/login';</script>");
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('auth');
    res.redirect('/login');
});

app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', checkAuth, async (req, res) => {
    try {
        const { data: users } = await supabase.from('users').select('*').order('joined_at', { ascending: false }).limit(100);
        const { count: total } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: paid } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_paid', true);
        const revenue = paid * 57000;
        const conversion = total > 0 ? ((paid / total) * 100).toFixed(1) : 0;
        let rows = users.map(u => `<tr><td>${u.id}</td><td>${u.full_name || u.name}</td><td>${u.username ? '@' + u.username : '-'}</td><td>${u.phone || '-'}</td><td>${u.is_paid ? '<span class="status-badge status-paid">TO\'LOV QILDI</span>' : '<span class="status-badge status-wait">KUTMOQDA</span>'}</td><td>${new Date(u.joined_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}</td></tr>`).join('');
        res.send(`
        <!DOCTYPE html>
        <html><head><title>Dashboard | 57 Premium Prompt</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            :root { --bg-color: #050505; --glass-bg: rgba(20, 20, 22, 0.6); --glass-border: rgba(212, 175, 55, 0.15); --gold-primary: #D4AF37; --text-main: #F3F4F6; --text-muted: #9CA3AF; }
            body { background: radial-gradient(circle at top right, #111115, var(--bg-color) 60%); color: var(--text-main); font-family: 'Inter', sans-serif; margin: 0; padding: 40px 20px; min-height: 100vh; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 25px; margin-bottom: 40px; }
            h1 { color: var(--text-main); margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; background: linear-gradient(to right, #fff, #aaa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .logout { color: var(--text-muted); text-decoration: none; padding: 10px 24px; background: var(--glass-bg); border: 1px solid rgba(255,255,255,0.1); border-radius: 30px; font-size: 14px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-bottom: 50px; }
            .card { background: var(--glass-bg); backdrop-filter: blur(20px); padding: 30px 25px; border-radius: 20px; border: 1px solid var(--glass-border); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
            .card h3 { margin: 0 0 15px 0; font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px; }
            .card .value { font-size: 38px; font-weight: 700; color: var(--text-main); }
            .card .value.gold { background: linear-gradient(135deg, #F3E5AB, #D4AF37, #AA8222); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .card .value.green { color: #34d399; }
            h2.table-title { color: var(--text-main); margin-bottom: 24px; font-size: 18px; font-weight: 600; text-transform: uppercase; }
            .table-card { background: var(--glass-bg); backdrop-filter: blur(20px); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th, td { padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.03); }
            th { background: rgba(0,0,0,0.2); color: var(--text-muted); font-weight: 500; text-transform: uppercase; font-size: 11px; letter-spacing: 1.5px; }
            td { font-size: 14px; color: #d1d5db; }
            .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-block; }
            .status-paid { background: rgba(52,211,153,0.1); color: #34d399; border: 1px solid rgba(52,211,153,0.2); }
            .status-wait { background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2); }
            .table-container { overflow-x: auto; }
        </style></head><body>
            <div class="container">
                <div class="header">
                    <h1>SOTUVLAR STATISTIKASI</h1>
                    <a href="/logout" class="logout">Tizimdan chiqish</a>
                </div>
                <div class="grid">
                    <div class="card"><h3>Jami obunachilar</h3><div class="value">${total}</div></div>
                    <div class="card"><h3>To'lov qilganlar</h3><div class="value green">${paid}</div></div>
                    <div class="card"><h3>Konversiya</h3><div class="value">${conversion}%</div></div>
                    <div class="card"><h3>Umumiy Daromad</h3><div class="value gold">${revenue.toLocaleString()} UZS</div></div>
                </div>
                <h2 class="table-title">Mijozlar bazasi</h2>
                <div class="table-card">
                    <div class="table-container">
                        <table>
                            <thead><tr><th>ID</th><th>Ism</th><th>Username</th><th>Raqam</th><th>Holat</th><th>Sana</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </body></html>
        `);
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
