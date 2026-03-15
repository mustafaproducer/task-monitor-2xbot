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
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running...\n');
}).listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

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
