require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SALES_GROUP_ID = process.env.SALES_GROUP_ID;
const CARD_NUMBER = process.env.CARD_NUMBER || "4073 4200 8249 5759 (Avazxonov S)";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '@azaayd';

const bot = new Telegraf(BOT_TOKEN);
const DB_FILE = './users.json';

// Render uchun Port ochish (Web Service xatosini oldini olish)
// --- ADMIN DASHBOARD (EXPRESS) ---
const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const DASHBOARD_USER = process.env.DASHBOARD_USER || 'admin';
const DASHBOARD_PASS = process.env.DASHBOARD_PASS || 'mustafa2026';
const AUTH_TOKEN = 'secret_2x_premium_token';

// Himoya (Auth)
function checkAuth(req, res, next) {
    if (req.cookies.auth === AUTH_TOKEN) return next();
    res.redirect('/login');
}

app.get('/login', (req, res) => {
    res.send(`
    <html><head><title>Admin Panel | Login</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { background: #0f0f11; color: #fff; font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #1a1a1d; padding: 40px; border-radius: 16px; border: 1px solid #D4AF37; box-shadow: 0 15px 35px rgba(212,175,55,0.15); text-align: center; width: 100%; max-width: 360px; }
        h2 { color: #D4AF37; margin-bottom: 30px; letter-spacing: 2px; font-weight: 600; }
        input { width: 100%; padding: 14px; margin-bottom: 20px; background: #0f0f11; border: 1px solid #333; color: #fff; border-radius: 8px; box-sizing: border-box; outline: none; font-size: 16px; transition: 0.3s; }
        input:focus { border-color: #D4AF37; box-shadow: 0 0 8px rgba(212,175,55,0.3); }
        button { width: 100%; padding: 14px; background: linear-gradient(135deg, #D4AF37, #AA8222); color: #000; border: none; border-radius: 8px; font-weight: 700; font-size: 16px; letter-spacing: 1px; cursor: pointer; transition: 0.3s; }
        button:hover { opacity: 0.9; transform: translateY(-2px); }
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
        res.redirect('/');
    } else {
        res.send("<script>alert('Login yoki parol xato!'); window.location.href='/login';</script>");
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('auth');
    res.redirect('/login');
});

app.get('/', checkAuth, (req, res) => {
    const usersArray = Object.values(db.users);
    const totalUsers = usersArray.length;
    const paidUsers = usersArray.filter(u => u.isPaid).length;
    const conversion = totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : 0;
    const revenue = paidUsers * 57000;

    let rows = '';
    usersArray.slice().reverse().forEach(u => {
        const date = new Date(u.joinedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
        const status = u.isPaid ? '<span style="color:#4ade80; font-weight:bold;">To\'lov qildi</span>' : '<span style="color:#f87171;">Kutmoqda</span>';
        rows += `<tr>
            <td>${u.id}</td>
            <td>${u.fullName || u.tgName || 'Kiritmadi'}</td>
            <td>${u.tgUsername ? '@'+u.tgUsername : '-'}</td>
            <td>${u.phone || '-'}</td>
            <td>${status}</td>
            <td>${date}</td>
        </tr>`;
    });

    res.send(`
    <html><head><title>Dashboard | 57 Premium Prompt</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { background: #0f0f11; color: #e5e7eb; font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222; padding-bottom: 20px; margin-bottom: 30px; }
        h1 { color: #D4AF37; margin: 0; font-size: 24px; letter-spacing: 1.5px; text-transform: uppercase; }
        .logout { color: #fff; text-decoration: none; padding: 10px 20px; border: 1px solid #D4AF37; border-radius: 6px; transition: 0.3s; font-weight: 600; font-size: 14px; }
        .logout:hover { background: #D4AF37; color: #000; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .card { background: #1a1a1d; padding: 25px; border-radius: 12px; border-top: 3px solid #D4AF37; box-shadow: 0 5px 15px rgba(0,0,0,0.4); transition: transform 0.3s; }
        .card:hover { transform: translateY(-5px); }
        .card h3 { margin: 0 0 10px 0; font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }
        .card .value { font-size: 32px; font-weight: 700; color: #fff; }
        .card .value.gold { color: #D4AF37; }
        .card .value.green { color: #4ade80; }
        .table-card { background: #1a1a1d; border-radius: 12px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.4); border: 1px solid #222; }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th, td { padding: 16px 20px; border-bottom: 1px solid #222; }
        th { background: #111; color: #D4AF37; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
        tr:hover { background: #1f1f23; }
        td { font-size: 14px; }
        .table-container { overflow-x: auto; }
        @media (max-width: 768px) {
            .header { flex-direction: column; gap: 15px; text-align: center; }
            .grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
            .grid { grid-template-columns: 1fr; }
        }
    </style></head><body>
        <div class="container">
            <div class="header">
                <h1>SOTUVLAR STATISTIKASI</h1>
                <a href="/logout" class="logout">Tizimdan chiqish</a>
            </div>
            
            <div class="grid">
                <div class="card"><h3>Jami obunachilar</h3><div class="value">${totalUsers}</div></div>
                <div class="card"><h3>To'lov qilganlar</h3><div class="value green">${paidUsers}</div></div>
                <div class="card"><h3>Konversiya</h3><div class="value">${conversion}%</div></div>
                <div class="card"><h3>Umumiy Daromad</h3><div class="value gold">${revenue.toLocaleString()} UZS</div></div>
            </div>

            <h2 style="color:#D4AF37; margin-bottom:20px; font-size:18px; letter-spacing: 1px; text-transform: uppercase;">Mijozlar bazasi</h2>
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
});

app.listen(PORT, () => {
    console.log(`Dashboard Server running on port ${PORT}`);
});
// --- END ADMIN DASHBOARD ---


let db = { users: {} };

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("Baza o'qishda xatolik:", e);
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getUser(userId, from) {
    if (!db.users[userId]) {
        db.users[userId] = {
            id: userId,
            tgName: from.first_name || '',
            tgUsername: from.username || '',
            joinedAt: new Date().toISOString(),
            step: 'START',
            fullName: null,
            phone: null,
            isPaid: false
        };
        saveDB();
    }
    return db.users[userId];
}

bot.start(async (ctx) => {
    const user = getUser(ctx.from.id, ctx.from);
    user.step = 'ASK_NAME';
    saveDB();

    try {
        const fileId = process.env.START_VIDEO_ID; 
        if(fileId) await ctx.replyWithVideoNote(fileId);
    } catch (e) {
        console.log('Video note yuborishda xatolik:', e.message);
    }
    
    await ctx.reply(
        "👋 Assalomu alaykum! Siz bu yerda Instagramda kontent qiluvchilar uchun maxsus tayyorlangan 57 ta eng sara Premium Promptlarni qo'lga kiritishingiz mumkin.\n\n" +
        "👇 Iltimos, Ismingizni kiriting (Masalan: Alisher)🔥",
        Markup.removeKeyboard()
    );
});

bot.command('export', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    
    let csv = "ID,TgName,Username,FullName,Phone,JoinedAt,IsPaid\n";
    for (const id in db.users) {
        const u = db.users[id];
        csv += `${u.id},"${u.tgName}","${u.tgUsername}","${u.fullName || ''}","${u.phone || ''}",${u.joinedAt},${u.isPaid}\n`;
    }
    
    fs.writeFileSync('users_export.csv', csv);
    await ctx.replyWithDocument({ source: 'users_export.csv', filename: 'Foydalanuvchilar_Bazasi.csv' });
});

bot.command('admin', (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const usersCount = Object.keys(db.users).length;
    const paidCount = Object.values(db.users).filter(u => u.isPaid).length;
    
    ctx.reply(`📊 Statistika\n\n👥 Jami foydalanuvchilar: ${usersCount}\n✅ To'lov qilganlar: ${paidCount}\n\n📥 Bazani olish: /export\n📢 Xabar yuborish: /broadcast [matn]`);
});

bot.command('broadcast', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const msg = ctx.message.text.split(' ').slice(1).join(' ');
    if (!msg) return ctx.reply("Matn kiriting! Yozilish tartibi: /broadcast Salom hammaga");
    
    let success = 0;
    ctx.reply("⏳ Xabar yuborilmoqda...");
    
    for (const id in db.users) {
        try {
            await ctx.telegram.sendMessage(id, msg);
            success++;
        } catch (e) {}
    }
    await ctx.reply(`✅ Xabar muvaffaqiyatli ${success} kishiga yuborildi.`);
});

bot.on('message', async (ctx) => {
    if (ctx.message.document || ctx.message.video || ctx.message.video_note) {
        if (String(ctx.from.id) === String(ADMIN_ID)) {
            const fileId = ctx.message.document?.file_id || ctx.message.video?.file_id || ctx.message.video_note?.file_id;
            if (fileId) {
                if (ctx.message.video_note) {
                    return ctx.reply(`📹 YUMALOQ VIDEO (VideoNote) ID:\n\n\`${fileId}\`\n\n(Buni nusxalab, menga yuboring!)`, { parse_mode: 'Markdown' });
                } else if (ctx.message.video) {
                    return ctx.reply(`🎬 ODDIY VIDEO ID:\n\n\`${fileId}\`\n\n(Buni nusxalab, menga yuboring!)`, { parse_mode: 'Markdown' });
                } else {
                    return ctx.reply(`📂 FAYL/HUJJAT ID:\n\n\`${fileId}\`\n\n(Buni nusxalab, menga yuboring!)`, { parse_mode: 'Markdown' });
                }
            }
        }
    }

    if (ctx.chat.type !== 'private') return;
    const userId = ctx.from.id;
    const user = getUser(userId, ctx.from);

    if (user.step === 'ASK_NAME' && ctx.message.text) {
        user.fullName = ctx.message.text;
        user.step = 'ASK_PHONE';
        saveDB();
        
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
        saveDB();
        
        await ctx.replyWithPhoto(
            { source: './poster.png' },
            {
                caption: `✅ Raqamingiz qabul qilindi.\n\n` +
                         `🎁 57 ta Premium Promptlarni qo'lga kiritish uchun:\n\n` +
                         `💳 Ushbu kartaga 57,000 so'm o'tkazing:\n` +
                         `\`${CARD_NUMBER}\`\n\n` +
                         `📸 So'ngra to'lov skrinshotini (chekini) shu botga rasm qilib tashlang!`,
                parse_mode: 'Markdown',
                ...Markup.removeKeyboard()
            }
        );
        return;
    }

    if (user.step === 'WAIT_FOR_PAYMENT' && ctx.message.photo) {
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        
        await ctx.reply("⏳ Skrinshot qabul qilindi! Admin tasdiqlashini kuting. Tasdiqlangach, maxsus guruhga link beriladi.");
        
        await ctx.telegram.sendPhoto(SALES_GROUP_ID, photoId, {
            caption: `🔔 YANGI TO'LOV KELDI!\n\n` +
                     `👤 Mijoz: ${user.fullName} (@${user.tgUsername || 'yoq'})\n` +
                     `📞 Raqam: ${user.phone}\n` +
                     `🆔 ID: ${user.id}`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Tasdiqlash', callback_data: `approve_${userId}` }],
                    [{ text: '❌ Rad etish', callback_data: `reject_${userId}` }]
                ]
            }
        });
        return;
    }

    const text = ctx.message.text;
    if (user.step === 'WAIT_FOR_PAYMENT' && text) {
        await ctx.reply(
            `Iltimos, to'lov skrinshotini (rasm qilib) yuboring.\n\n` +
            `💳 Karta: \`${CARD_NUMBER}\` (57,000 so'm)`,
            { parse_mode: 'Markdown', ...Markup.removeKeyboard() }
        );
    }
});

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    if (data.startsWith('approve_') || data.startsWith('reject_')) {
        const action = data.split('_')[0];
        const targetUserId = data.split('_')[1];
        const targetUser = db.users[targetUserId];

        if (action === 'approve') {
            try {
                const expireDate = Math.floor(Date.now() / 1000) + 86400;
                const linkRes = await ctx.telegram.createChatInviteLink(CHANNEL_ID, {
                    member_limit: 1,
                    expire_date: expireDate
                });
                
                const inviteLink = linkRes.invite_link;
                
                await ctx.telegram.sendMessage(targetUserId, 
                    `🎉 To'lovingiz tasdiqlandi, kutganingiz uchun rahmat!\n\n` +
                    `Mana sizga yopiq kanal uchun maxsus link:\n🔗 ${inviteLink}\n\n` +
                    `⚠️ Bu link faqat "BIR MARTA" ishlaydi va "24 soat" ichida kuyadi!`
                );
                
                if(targetUser) {
                    targetUser.isPaid = true;
                    saveDB();
                }
                
                const oldCaption = ctx.callbackQuery.message.caption || '';
                const newCaption = oldCaption.replace("🔔 YANGI TO'LOV KELDI!", "✅ TASDIQLANDI");
                await ctx.editMessageCaption(newCaption);
                
            } catch (err) {
                console.error("Link yaratishda xatolik:", err);
                await ctx.answerCbQuery("Link yaratishda xatolik!");
            }
        } 
        else if (action === 'reject') {
            await ctx.telegram.sendMessage(targetUserId, 
                `❌ Kechirasiz, to'lovingiz tasdiqlanmadi.\n\n` +
                `Admin bilan bog'laning: ${ADMIN_USERNAME}`
            );
            
            const oldCaption = ctx.callbackQuery.message.caption || '';
            const newCaption = oldCaption.replace("🔔 YANGI TO'LOV KELDI!", "❌ RAD ETILDI");
            await ctx.editMessageCaption(newCaption);
        }
        await ctx.answerCbQuery();
    }
});

bot.catch((err) => {
    console.log('Bot xatosi:', err);
});

bot.launch({
    allowedUpdates: ['message', 'callback_query', 'contact'],
    dropPendingUpdates: true 
}).then(() => {
    console.log("🚀 BOT MUVAFFAQIYATLI ISHGA TUSHDI! (ID: " + Math.random().toString(36).substring(7) + ")");
}).catch((err) => {
    if (err.response && err.response.error_code === 409) {
        console.log("⚠️ Conflict aniqlandi. 5 soniyadan keyin qayta urunib ko'ramiz...");
        setTimeout(() => process.exit(1), 5000); // 409 bo'lsa processni yopamiz, Render o'zi qayta yoqadi
    } else {
        console.error("Bot launch xatosi:", err);
    }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
