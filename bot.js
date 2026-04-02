require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cookieParser = require('cookie-parser');

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
    supabaseKey: process.env.SUPABASE_KEY
};

// --- SUPABASE SETUP ---
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

// --- CORE FUNCTIONS ---
async function getDBUser(ctx) {
    const id = String(ctx.from.id);
    try {
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (user) return user;

        const newUser = {
            id,
            name: ctx.from.first_name || "Do'st",
            username: ctx.from.username || '',
            step: 'START'
        };
        const { data: created } = await supabase.from('users').insert([newUser]).select().single();
        return created || newUser;
    } catch (err) {
        console.error("getDBUser Error:", err.message);
        return { id, name: ctx.from.first_name, step: 'START' };
    }
}

async function saveUser(user) {
    try {
        await supabase
            .from('users')
            .update(user)
            .eq('id', user.id);
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
    const { data: targetUser } = await supabase.from('users').select('*').eq('id', uid).single();

    if (action === 'approve') {
        try {
            const link = await ctx.telegram.createChatInviteLink(config.channelId || config.coreChannelId, { member_limit: 1, expire_date: Math.floor(Date.now()/1000)+86400 });
            await ctx.telegram.sendMessage(uid, `🎉 To'lovingiz tasdiqlandi!\n\n🔗 Havola: ${link.invite_link}\n\n⚠️ Faqat bir marta ishlaydi!`);
            
            if (targetUser) {
                await supabase.from('users').update({ is_paid: true }).eq('id', uid);
            }
            
            await ctx.editMessageCaption(ctx.callbackQuery.message.caption.replace("🔔 *YANGI TO'LOV*", "✅ *TASDIQLANDI*"), { parse_mode: 'Markdown' });
            await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        } catch (e) { await ctx.answerCbQuery("Xatolik! Bot adminmi?"); }
    } else if (action === 'reject') {
        await ctx.telegram.sendMessage(uid, `❌ To'lov tasdiqlanmadi. Admin: ${config.adminUsername}`);
        await ctx.editMessageCaption(ctx.callbackQuery.message.caption.replace("🔔 *YANGI TO'LOV*", "❌ *RAD ETILDI*"), { parse_mode: 'Markdown' });
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    }
    await ctx.answerCbQuery();
});

// --- ADMIN DASHBOARD ---
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
    res.send(`<!DOCTYPE html><html><head><title>Admin Panel | Login</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body { background: #050505; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }.card { background: rgba(20, 20, 22, 0.6); padding: 40px; border-radius: 20px; border: 1px solid rgba(212, 175, 55, 0.15); text-align: center; width: 100%; max-width: 360px; }h2 { color: #D4AF37; }input { width: 100%; padding: 14px; margin-bottom: 20px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 12px; }button { width: 100%; padding: 14px; background: #D4AF37; color: #000; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; }</style></head><body><div class="card"><h2>ADMIN PANEL</h2><form method="POST" action="/login"><input type="text" name="username" placeholder="Login" required><input type="password" name="password" placeholder="Parol" required><button type="submit">KIRISH</button></form></div></body></html>`);
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === DASHBOARD_USER && password === DASHBOARD_PASS) {
        res.cookie('auth', AUTH_TOKEN, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true });
        res.redirect('/dashboard');
    } else {
        res.send("<script>alert('Xato!'); window.location.href='/login';</script>");
    }
});

app.get('/dashboard', checkAuth, async (req, res) => {
    const { data: users } = await supabase.from('users').select('*').order('joined_at', { ascending: false }).limit(100);
    const { count: total } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: paid } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_paid', true);
    
    let rows = users.map(u => `<tr><td>${u.id}</td><td>${u.full_name || u.name}</td><td>${u.username ? '@'+u.username : '-'}</td><td>${u.phone || '-'}</td><td>${u.is_paid ? 'HA' : 'YOQ'}</td><td>${new Date(u.joined_at).toLocaleString()}</td></tr>`).join('');
    res.send(`<!DOCTYPE html><html><head><title>Dashboard</title><style>body{background:#050505;color:#fff;font-family:sans-serif;padding:40px;}table{width:100%;border-collapse:collapse;}th,td{padding:15px;border-bottom:1px solid #333;text-align:left;}.stat{display:flex;gap:20px;margin-bottom:40px;}.card{background:#111;padding:20px;border-radius:10px;border:1px solid #D4AF37;flex:1;}</style></head><body><h1>SOTUVLAR STATISTIKASI</h1><div class="stat"><div class="card"><h3>Jami</h3><h2>${total}</h2></div><div class="card"><h3>To'laganlar</h3><h2>${paid}</h2></div></div><table><thead><tr><th>ID</th><th>Ism</th><th>User</th><th>Raqam</th><th>To'lov</th><th>Sana</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
});

app.get('/', (req, res) => res.redirect('/dashboard'));

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
