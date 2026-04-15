require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cookieParser = require('cookie-parser');
const { getProduct, getActiveProducts } = require('./products');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.body && req.body.update_id) {
        console.log(`[Update ID] ${req.body.update_id}`);
    }
    next();
});

// --- Configuration ---
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

if (!config.supabaseUrl || !config.supabaseKey) {
    console.error("❌ ERROR: SUPABASE_URL or SUPABASE_KEY is missing from environment variables!");
}

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

// --- Main Menu Keyboard ---
const mainMenu = Markup.keyboard([
    ['🛍 Mahsulotlar', '👤 Profilim'],
    ['🎁 Bepul namunalar', '📞 Admin']
]).resize();

// --- User Helpers ---
async function getDBUser(ctx) {
    const id = String(ctx.from.id);
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (user) return user;

        const newUser = {
            id,
            name: ctx.from.first_name || "Do'st",
            username: ctx.from.username || '',
            step: 'START'
        };
        const { data: created, error: insError } = await supabase.from('users').insert([newUser]).select().single();
        if (insError) throw insError;
        return created || newUser;
    } catch (err) {
        console.error("getDBUser Error:", err.message);
        return { id, name: ctx.from.first_name, step: 'START' };
    }
}

const USER_COLUMNS = [
    'name', 'username', 'full_name', 'phone', 'is_paid', 'step',
    'pending_product_id', 'paid_products', 'draft_announcement_id'
];

async function updateUserFields(id, patch) {
    const { error } = await supabase.from('users').update(patch).eq('id', id);
    if (error) {
        console.error(`[updateUserFields] ${id} fields=${Object.keys(patch).join(',')} err=${error.message}`);
        // Retry once with each field individually so one bad column doesn't drop the rest.
        for (const [k, v] of Object.entries(patch)) {
            const { error: e2 } = await supabase.from('users').update({ [k]: v }).eq('id', id);
            if (e2) console.error(`[updateUserFields] skip ${k}: ${e2.message}`);
        }
    }
}

async function saveUser(user) {
    const fields = {};
    for (const k of USER_COLUMNS) {
        if (user[k] !== undefined) fields[k] = user[k];
    }
    await updateUserFields(user.id, fields);
}

function hasPurchased(user, productId) {
    return Array.isArray(user.paid_products) && user.paid_products.includes(productId);
}

// --- Announcement Helpers ---
async function createDraft(adminId) {
    const { data, error } = await supabase
        .from('announcements')
        .insert([{ admin_id: adminId }])
        .select()
        .single();
    if (error) { console.error('createDraft:', error.message); throw error; }
    return data;
}

async function updateDraft(id, fields) {
    const { data, error } = await supabase
        .from('announcements')
        .update(fields)
        .eq('id', id)
        .select()
        .single();
    if (error) { console.error('updateDraft:', error.message); throw error; }
    return data;
}

async function getDraft(id) {
    const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) { console.error('getDraft:', error.message); return null; }
    return data;
}

function buildAnnouncementKeyboard(draft) {
    if (!draft.button_text) return undefined;
    if (draft.button_url) {
        return { inline_keyboard: [[{ text: draft.button_text, url: draft.button_url }]] };
    }
    if (draft.button_product_id) {
        return { inline_keyboard: [[{ text: draft.button_text, callback_data: `view_product_${draft.button_product_id}` }]] };
    }
    return undefined;
}

async function fetchTargetUsers(target, productId) {
    let q = supabase.from('users').select('id, paid_products');
    if (target === 'paid') q = q.eq('is_paid', true);
    else if (target === 'unpaid') q = q.eq('is_paid', false);
    const { data } = await q;
    const users = data || [];
    if (target === 'product' && productId) {
        return users.filter(u => Array.isArray(u.paid_products) && u.paid_products.includes(productId));
    }
    return users;
}

async function deliverAnnouncement(userId, draft) {
    const reply_markup = buildAnnouncementKeyboard(draft);
    const opts = {};
    if (reply_markup) opts.reply_markup = reply_markup;
    const caption = draft.caption || '';
    const fid = draft.photo_file_id;
    const mtype = draft.media_type || 'photo';
    if (!fid) {
        return bot.telegram.sendMessage(userId, caption, opts);
    }
    if (mtype === 'video') return bot.telegram.sendVideo(userId, fid, { caption, ...opts });
    if (mtype === 'document') return bot.telegram.sendDocument(userId, fid, { caption, ...opts });
    if (mtype === 'animation') return bot.telegram.sendAnimation(userId, fid, { caption, ...opts });
    return bot.telegram.sendPhoto(userId, fid, { caption, ...opts });
}

async function sendPreview(ctx, draft) {
    await ctx.reply("👀 *Preview* — quyidagicha yuboriladi:", { parse_mode: 'Markdown' });
    const reply_markup = buildAnnouncementKeyboard(draft);
    const opts = {};
    if (reply_markup) opts.reply_markup = reply_markup;
    const caption = draft.caption || '';
    const fid = draft.photo_file_id;
    const mtype = draft.media_type || 'photo';
    if (!fid) {
        await ctx.reply(caption, opts);
    } else if (mtype === 'video') {
        await ctx.replyWithVideo(fid, { caption, ...opts });
    } else if (mtype === 'document') {
        await ctx.replyWithDocument(fid, { caption, ...opts });
    } else if (mtype === 'animation') {
        await ctx.replyWithAnimation(fid, { caption, ...opts });
    } else {
        await ctx.replyWithPhoto(fid, { caption, ...opts });
    }
    const targetLabels = { all: "👥 Hammaga", paid: "✅ To'laganlarga", unpaid: "⏳ To'lamaganlarga", product: "🎯 Mahsulot sotib olganlarga" };
    await ctx.reply(
        `🎯 Maqsadli auditoriya: *${targetLabels[draft.target] || draft.target}*\n\nYuborishni tasdiqlaysizmi?`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ Yuborish', callback_data: `ann_send_${draft.id}` },
                    { text: '❌ Bekor qilish', callback_data: `ann_cancel_${draft.id}` }
                ]]
            }
        }
    );
}

function showTargetMenu(ctx) {
    return ctx.reply("4/5 — 🎯 Kimga yuborilsin?", {
        reply_markup: {
            inline_keyboard: [
                [{ text: '👥 Hammaga', callback_data: 'ann_target_all' }],
                [{ text: "✅ To'laganlarga", callback_data: 'ann_target_paid' }],
                [{ text: "⏳ To'lamaganlarga", callback_data: 'ann_target_unpaid' }],
                [{ text: '🎯 Mahsulot sotib olganlarga', callback_data: 'ann_target_product' }]
            ]
        }
    });
}

async function handleAnnouncementStep(ctx, user) {
    const draftId = user.draft_announcement_id;
    if (!draftId) {
        user.step = 'MAIN_MENU';
        await saveUser(user);
        return ctx.reply("Draft topilmadi. /announce bilan qaytadan boshlang.");
    }

    const step = user.step;

    if (step === 'ANN_PHOTO') {
        let fileId = null, mediaType = null, label = null;
        if (ctx.message.photo) {
            fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            mediaType = 'photo';
            label = 'Rasm';
        } else if (ctx.message.video) {
            fileId = ctx.message.video.file_id;
            mediaType = 'video';
            label = 'Video';
        } else if (ctx.message.animation) {
            fileId = ctx.message.animation.file_id;
            mediaType = 'animation';
            label = 'GIF';
        } else if (ctx.message.document) {
            fileId = ctx.message.document.file_id;
            mediaType = 'document';
            label = 'Hujjat';
        }

        if (fileId) {
            await updateDraft(draftId, { photo_file_id: fileId, media_type: mediaType });
            user.step = 'ANN_CAPTION';
            await saveUser(user);
            return ctx.reply(`✅ ${label} qabul qilindi.\n\n2/5 — ✍️ Matn (caption) yuboring:`);
        }
        return ctx.reply("📸 Iltimos, rasm / video / GIF / hujjat yuboring yoki /skip (matnli e'lon uchun). Bekor qilish: /cancel");
    }

    if (step === 'ANN_CAPTION') {
        if (ctx.message.text) {
            await updateDraft(draftId, { caption: ctx.message.text });
            user.step = 'ANN_BUTTON_ASK';
            await saveUser(user);
            return ctx.reply("3/5 — 🔘 Tugma qo'shasizmi?", {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Ha', callback_data: 'ann_btn_yes' },
                        { text: "❌ Yo'q", callback_data: 'ann_btn_no' }
                    ]]
                }
            });
        }
        return ctx.reply("✍️ Iltimos, matn (caption) yuboring. Bekor qilish: /cancel");
    }

    if (step === 'ANN_BUTTON_TEXT') {
        if (ctx.message.text) {
            await updateDraft(draftId, { button_text: ctx.message.text });
            user.step = 'ANN_BUTTON_TYPE';
            await saveUser(user);
            return ctx.reply("Tugma turini tanlang:", {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔗 URL', callback_data: 'ann_btntype_url' },
                        { text: '🛍 Mahsulot', callback_data: 'ann_btntype_product' }
                    ]]
                }
            });
        }
        return ctx.reply("Tugma matnini yuboring (masalan: 🛍 Sotib olish)");
    }

    if (step === 'ANN_BUTTON_URL') {
        if (ctx.message.text) {
            const url = ctx.message.text.trim();
            if (!/^https?:\/\//i.test(url) && !/^tg:\/\//i.test(url)) {
                return ctx.reply("❌ Noto'g'ri URL. https:// bilan boshlanishi kerak. Qaytadan yuboring:");
            }
            await updateDraft(draftId, { button_url: url });
            user.step = 'ANN_TARGET';
            await saveUser(user);
            return showTargetMenu(ctx);
        }
        return ctx.reply("URL manzilini yuboring (https://...)");
    }

    return ctx.reply("Kutilmagan javob. /cancel bilan bekor qilib qayta boshlang.");
}

// --- Bot Setup ---
const bot = new Telegraf(config.token);

// ========== /start ==========
bot.start(async (ctx) => {
    const user = await getDBUser(ctx);

    // Returning user with completed onboarding → go straight to main menu
    if (user.full_name && user.phone) {
        user.step = 'MAIN_MENU';
        await saveUser(user);
        return ctx.reply(
            `👋 Xush kelibsiz, ${user.full_name}!\n\nQuyidagi menyudan foydalaning 👇`,
            mainMenu
        );
    }

    user.step = 'ASK_NAME';
    await saveUser(user);

    try {
        const fileId = process.env.START_VIDEO_ID;
        if (fileId) await ctx.replyWithVideoNote(fileId);
    } catch (e) { console.log('VideoNote skip'); }

    await ctx.reply(
        "👋 Assalomu alaykum va 2xPREMIUM botiga xush kelibsiz!\n\n" +
        "Bu yerda siz Instagram kontent yaratuvchilari uchun tayyorlangan Premium mahsulotlarni qo'lga kiritishingiz mumkin.\n\n" +
        "👇 Iltimos, Ismingizni kiriting (Masalan: Alisher) 🔥",
        Markup.removeKeyboard()
    );
});

// ========== Admin Commands ==========
bot.command('admin', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;

    const { count: total } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: paid } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_paid', true);

    ctx.reply(
        `📊 Statistika\n\n👥 Jami: ${total}\n✅ To'laganlar: ${paid}\n\n📥 /export\n📢 /broadcast [text]\n🔗 /resetpending — to'lov kutayotganlarni reset qilish`,
        {
            reply_markup: {
                inline_keyboard: [[{ text: '🔗 YAKKA LINK YARATISH', callback_data: 'generate_admin_link' }]]
            }
        }
    );
});

bot.action('generate_admin_link', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return ctx.answerCbQuery("Siz admin emassiz!");
    try {
        const link = await ctx.telegram.createChatInviteLink(config.channelId || config.coreChannelId, {
            member_limit: 1,
            expire_date: Math.floor(Date.now() / 1000) + 86400
        });
        await ctx.reply(`Tabriklaymiz! Bir martalik havola 24 soat amal qiladi:\n\n${link.invite_link}`);
        await ctx.answerCbQuery("Yangi link yaratildi!");
    } catch (e) {
        console.error("Link xatosi:", e);
        await ctx.answerCbQuery("Xatolik! Bot kanalga adminmi?");
    }
});

bot.command('export', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;
    const { data: users } = await supabase.from('users').select('*');
    let csv = "ID,Name,Username,FullName,Phone,IsPaid,Products\n";
    users.forEach(u => {
        const prods = Array.isArray(u.paid_products) ? u.paid_products.join(';') : '';
        csv += `${u.id},"${u.name}","${u.username}","${u.full_name || ''}","${u.phone || ''}",${u.is_paid},"${prods}"\n`;
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

// Reset users who were mid-payment on the old 57,000 price so they see new menu
bot.command('resetpending', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;
    const { data: stuck } = await supabase
        .from('users')
        .select('id')
        .eq('step', 'WAIT_FOR_PAYMENT')
        .eq('is_paid', false);
    if (!stuck || stuck.length === 0) return ctx.reply("Kutayotgan foydalanuvchi yo'q.");

    for (const u of stuck) {
        await supabase.from('users').update({ step: 'MAIN_MENU', pending_product_id: null }).eq('id', u.id);
        try {
            await bot.telegram.sendMessage(
                u.id,
                "📢 Narxlar yangilandi! Botimiz yangi mahsulotlar bilan qaytdi.\n\nIltimos /start buyrug'ini bosing 👇"
            );
        } catch (e) {}
    }
    ctx.reply(`✅ ${stuck.length} ta foydalanuvchi reset qilindi.`);
});

// ========== /announce — Rich Broadcast ==========
bot.command('announce', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;
    const user = await getDBUser(ctx);
    try {
        const draft = await createDraft(config.adminId);
        user.step = 'ANN_PHOTO';
        user.draft_announcement_id = draft.id;
        await saveUser(user);
        await ctx.reply(
            "📢 *Yangi e'lon yaratish*\n\n" +
            "1/5 — 📸 Media yuboring (rasm, video, GIF yoki hujjat)\n" +
            "(yoki /skip — matnsiz e'lon uchun)\n\n" +
            "Bekor qilish: /cancel",
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        ctx.reply("❌ Xatolik: " + e.message);
    }
});

bot.command('cancel', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;
    const user = await getDBUser(ctx);
    if (!user.step || !user.step.startsWith('ANN_')) {
        return ctx.reply("Bekor qiladigan narsa yo'q.");
    }
    if (user.draft_announcement_id) {
        await updateDraft(user.draft_announcement_id, { status: 'cancelled' }).catch(() => {});
    }
    user.step = 'MAIN_MENU';
    user.draft_announcement_id = null;
    await saveUser(user);
    await ctx.reply("❌ E'lon yaratish bekor qilindi.", mainMenu);
});

bot.command('skip', async (ctx) => {
    if (String(ctx.from.id) !== config.adminId) return;
    const user = await getDBUser(ctx);
    if (user.step === 'ANN_PHOTO') {
        user.step = 'ANN_CAPTION';
        await saveUser(user);
        return ctx.reply("2/5 — ✍️ Matn (caption) yuboring:");
    }
});

// Admin announcement middleware — intercepts admin messages in ANN_* state
// so they don't get hijacked by menu button handlers.
bot.use(async (ctx, next) => {
    if (ctx.callbackQuery) return next();
    if (!ctx.message) return next();
    if (!ctx.from || String(ctx.from.id) !== config.adminId) return next();
    if (ctx.message.text && ctx.message.text.startsWith('/')) return next();

    const user = await getDBUser(ctx);
    if (!user.step || !user.step.startsWith('ANN_')) return next();

    return handleAnnouncementStep(ctx, user);
});

// ========== Menu Button Handlers ==========
bot.hears('🛍 Mahsulotlar', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const user = await getDBUser(ctx);
    if (!user.full_name || !user.phone) {
        return ctx.reply("Avval /start buyrug'i orqali ro'yxatdan o'ting.");
    }
    const products = getActiveProducts();
    if (products.length === 0) return ctx.reply("Hozircha mahsulotlar yo'q. Tez orada! 🔜");

    const buttons = products.map(p => [
        Markup.button.callback(`${p.emoji} ${p.title} — ${p.priceText}`, `view_product_${p.id}`)
    ]);
    await ctx.reply("🛍 *Mahsulotlar*\n\nQuyidagilardan birini tanlang:", {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
    });
});

bot.hears('👤 Profilim', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const user = await getDBUser(ctx);
    if (!user.full_name || !user.phone) {
        return ctx.reply("Avval /start buyrug'i orqali ro'yxatdan o'ting.");
    }
    const paidList = Array.isArray(user.paid_products) && user.paid_products.length > 0
        ? user.paid_products.map(pid => {
            const p = getProduct(pid);
            return p ? `✅ ${p.emoji} ${p.title}` : `✅ ${pid}`;
        }).join('\n')
        : "— Hozircha xaridlar yo'q";

    await ctx.reply(
        `👤 *Profilingiz*\n\n` +
        `📛 Ism: ${user.full_name}\n` +
        `📞 Raqam: ${user.phone}\n` +
        `🆔 ID: \`${user.id}\`\n\n` +
        `🛍 *Sotib olganlaringiz:*\n${paidList}`,
        { parse_mode: 'Markdown' }
    );
});

bot.hears('🎁 Bepul namunalar', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const user = await getDBUser(ctx);
    if (!user.full_name || !user.phone) {
        return ctx.reply("Avval /start buyrug'i orqali ro'yxatdan o'ting.");
    }

    await ctx.reply("🎁 Sizga sovg'a — 2 ta bepul Premium prompt namunasi!");
    try {
        await ctx.replyWithDocument({ source: 'freebies/22_Kontent_matritsa_Mutaxassisi.pdf' });
        await ctx.replyWithDocument({ source: 'freebies/53_VIP_taklif_Mutaxassisi.pdf' });
        await ctx.reply(
            "✨ Bularni yoqtirdingizmi? 57 ta to'liq Premium Promptlar to'plamini olish uchun *🛍 Mahsulotlar* tugmasini bosing!",
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error("Freebie send error:", e.message);
        await ctx.reply("Kechirasiz, fayllarni yuborishda xatolik. Admin bilan bog'laning.");
    }
});

bot.hears('📞 Admin', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const adminUser = config.adminUsername.replace('@', '');
    await ctx.reply(
        `📞 Savol yoki muammo bo'lsa, admin bilan bog'laning:\n\n${config.adminUsername}`,
        {
            reply_markup: {
                inline_keyboard: [[{ text: "👨‍💻 Adminga yozish", url: `https://t.me/${adminUser}` }]]
            }
        }
    );
});

// ========== Product View & Buy ==========
bot.action(/view_product_(.+)/, async (ctx) => {
    const productId = ctx.match[1];
    const product = getProduct(productId);
    if (!product || !product.active) return ctx.answerCbQuery("Mahsulot topilmadi.");

    const user = await getDBUser(ctx);
    const alreadyBought = hasPurchased(user, productId);

    const buttons = alreadyBought
        ? [[{ text: "✅ Sotib olingan", callback_data: 'noop' }]]
        : [[{ text: `💳 Sotib olish — ${product.priceText}`, callback_data: `buy_${productId}` }]];

    try {
        await ctx.replyWithPhoto(
            { source: product.poster },
            {
                caption: product.fullDescription,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            }
        );
    } catch (e) {
        await ctx.reply(product.fullDescription, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });
    }
    await ctx.answerCbQuery();
});

bot.action(/buy_(.+)/, async (ctx) => {
    const productId = ctx.match[1];
    const product = getProduct(productId);
    if (!product || !product.active) return ctx.answerCbQuery("Mahsulot topilmadi.");

    const user = await getDBUser(ctx);
    if (hasPurchased(user, productId)) {
        return ctx.answerCbQuery("Siz allaqachon sotib olgansiz!");
    }

    user.step = 'WAIT_FOR_PAYMENT';
    user.pending_product_id = productId;
    await saveUser(user);

    await ctx.reply(
        `💳 *To'lov* — ${product.title}\n\n` +
        `Ushbu kartaga *${product.priceText}* o'tkazing:\n` +
        `\`${config.cardNumber}\`\n\n` +
        `📸 So'ngra to'lov chekini (skrinshot) shu yerga rasm qilib yuboring.\n\n` +
        `♻️ Bekor qilish: /start`,
        { parse_mode: 'Markdown' }
    );
    await ctx.answerCbQuery();
});

bot.action('noop', (ctx) => ctx.answerCbQuery());

// ========== Announcement Callbacks ==========
const isAdmin = (ctx) => String(ctx.from.id) === config.adminId;

bot.action('ann_btn_yes', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    const user = await getDBUser(ctx);
    user.step = 'ANN_BUTTON_TEXT';
    await saveUser(user);
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await ctx.reply("Tugma matnini yuboring (masalan: 🛍 Sotib olish):");
    await ctx.answerCbQuery();
});

bot.action('ann_btn_no', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    const user = await getDBUser(ctx);
    user.step = 'ANN_TARGET';
    await saveUser(user);
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await showTargetMenu(ctx);
    await ctx.answerCbQuery();
});

bot.action('ann_btntype_url', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    const user = await getDBUser(ctx);
    user.step = 'ANN_BUTTON_URL';
    await saveUser(user);
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await ctx.reply("🔗 URL manzilini yuboring (https:// bilan boshlanishi kerak):");
    await ctx.answerCbQuery();
});

bot.action('ann_btntype_product', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    const activeProducts = getActiveProducts();
    if (activeProducts.length === 0) return ctx.answerCbQuery("Mahsulot yo'q");
    const buttons = activeProducts.map(p => [{ text: `${p.emoji} ${p.title}`, callback_data: `ann_prod_${p.id}` }]);
    await ctx.editMessageReplyMarkup({ inline_keyboard: buttons }).catch(() => {});
    await ctx.answerCbQuery();
});

bot.action(/ann_prod_(.+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    const productId = ctx.match[1];
    const user = await getDBUser(ctx);
    await updateDraft(user.draft_announcement_id, { button_product_id: productId });
    user.step = 'ANN_TARGET';
    await saveUser(user);
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await showTargetMenu(ctx);
    await ctx.answerCbQuery();
});

bot.action(/ann_target_(all|paid|unpaid|product)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    const target = ctx.match[1];
    const user = await getDBUser(ctx);

    if (target === 'product') {
        const activeProducts = getActiveProducts();
        const buttons = activeProducts.map(p => [{ text: `${p.emoji} ${p.title}`, callback_data: `ann_tprod_${p.id}` }]);
        await ctx.editMessageReplyMarkup({ inline_keyboard: buttons }).catch(() => {});
        return ctx.answerCbQuery();
    }

    await updateDraft(user.draft_announcement_id, { target });
    user.step = 'ANN_CONFIRM';
    await saveUser(user);
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    const draft = await getDraft(user.draft_announcement_id);
    await sendPreview(ctx, draft);
    await ctx.answerCbQuery();
});

bot.action(/ann_tprod_(.+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    const productId = ctx.match[1];
    const user = await getDBUser(ctx);
    await updateDraft(user.draft_announcement_id, { target: 'product', target_product_id: productId });
    user.step = 'ANN_CONFIRM';
    await saveUser(user);
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    const draft = await getDraft(user.draft_announcement_id);
    await sendPreview(ctx, draft);
    await ctx.answerCbQuery();
});

bot.action(/ann_send_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    const draftId = parseInt(ctx.match[1], 10);
    const draft = await getDraft(draftId);
    if (!draft) return ctx.answerCbQuery("Draft topilmadi");

    const targets = await fetchTargetUsers(draft.target, draft.target_product_id);
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await ctx.reply(`⏳ ${targets.length} ta foydalanuvchiga yuborilmoqda...`);

    let sent = 0, failed = 0;
    for (const u of targets) {
        try {
            await deliverAnnouncement(u.id, draft);
            sent++;
        } catch (e) {
            failed++;
        }
        // Throttle to stay under Telegram's ~30 msg/sec limit
        if ((sent + failed) % 25 === 0) await new Promise(r => setTimeout(r, 1100));
    }

    await updateDraft(draftId, {
        status: 'sent',
        sent_count: sent,
        failed_count: failed,
        sent_at: new Date().toISOString()
    });

    const user = await getDBUser(ctx);
    user.step = 'MAIN_MENU';
    user.draft_announcement_id = null;
    await saveUser(user);

    await ctx.reply(`✅ Tayyor!\n\n📤 Yuborildi: ${sent}\n❌ Xatolik: ${failed}`, mainMenu);
    await ctx.answerCbQuery();
});

bot.action(/ann_cancel_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    const draftId = parseInt(ctx.match[1], 10);
    await updateDraft(draftId, { status: 'cancelled' }).catch(() => {});
    const user = await getDBUser(ctx);
    user.step = 'MAIN_MENU';
    user.draft_announcement_id = null;
    await saveUser(user);
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await ctx.reply("❌ E'lon bekor qilindi.", mainMenu);
    await ctx.answerCbQuery();
});

// ========== Onboarding + Payment Messages ==========
bot.on('message', async (ctx) => {
    // Admin file-id helper
    if (String(ctx.from.id) === config.adminId && (ctx.message.document || ctx.message.video || ctx.message.video_note)) {
        const fid = ctx.message.document?.file_id || ctx.message.video?.file_id || ctx.message.video_note?.file_id;
        return ctx.reply(`ID: \`${fid}\``, { parse_mode: 'Markdown' });
    }

    if (ctx.chat.type !== 'private') return;
    const user = await getDBUser(ctx);

    // Onboarding: contact — accept whenever phone is missing, regardless of step.
    // Fixes the case where saveUser silently failed and step never advanced to ASK_PHONE.
    if (ctx.message.contact && !user.phone) {
        user.phone = ctx.message.contact.phone_number;
        if (!user.full_name) user.full_name = ctx.from.first_name || "Do'st";
        user.step = 'MAIN_MENU';
        await saveUser(user);
        return ctx.reply(
            `✅ Ro'yxatdan o'tish yakunlandi!\n\n` +
            `Endi *🛍 Mahsulotlar* tugmasini bosib mahsulotlarimiz bilan tanishing, yoki *🎁 Bepul namunalar* olib ko'ring!`,
            { parse_mode: 'Markdown', ...mainMenu }
        );
    }

    // Onboarding: name
    if (user.step === 'ASK_NAME' && ctx.message.text) {
        user.full_name = ctx.message.text;
        user.step = 'ASK_PHONE';
        await saveUser(user);
        return ctx.reply(
            `Rahmat, ${user.full_name}!\n\nEndi telefon raqamingizni pastdagi tugma orqali yuboring 👇`,
            Markup.keyboard([[Markup.button.contactRequest("📱 Raqamni yuborish")]]).oneTime().resize()
        );
    }

    // Onboarding: phone
    if (user.step === 'ASK_PHONE' && (ctx.message.contact || ctx.message.text)) {
        user.phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
        user.step = 'MAIN_MENU';
        await saveUser(user);
        return ctx.reply(
            `✅ Ro'yxatdan o'tish yakunlandi!\n\n` +
            `Endi *🛍 Mahsulotlar* tugmasini bosib mahsulotlarimiz bilan tanishing, yoki *🎁 Bepul namunalar* olib ko'ring!`,
            { parse_mode: 'Markdown', ...mainMenu }
        );
    }

    // Payment: screenshot received
    if (user.step === 'WAIT_FOR_PAYMENT' && ctx.message.photo) {
        const productId = user.pending_product_id;
        const product = productId ? getProduct(productId) : null;
        if (!product) {
            return ctx.reply("Xatolik: mahsulot topilmadi. /start buyrug'ini bosing.");
        }

        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

        await ctx.reply("⏳ Skrinshot qabul qilindi! Admin tasdiqlashini kuting.", {
            reply_markup: {
                inline_keyboard: [[{ text: "👨‍💻 Admin bilan bog'lanish", url: `https://t.me/${config.adminUsername.replace('@','')}` }]]
            }
        });

        return ctx.telegram.sendPhoto(config.salesGroupId, photoId, {
            caption:
                `🔔 *YANGI TO'LOV*\n\n` +
                `🛍 Mahsulot: *${product.emoji} ${product.title}*\n` +
                `💰 Narx: *${product.priceText}*\n` +
                `👤 ${user.full_name} (@${user.username || 'yoq'})\n` +
                `📞 ${user.phone}\n` +
                `🆔 ${user.id}`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ Tasdiqlash', callback_data: `approve_${user.id}_${productId}` },
                    { text: '❌ Rad etish', callback_data: `reject_${user.id}_${productId}` }
                ]]
            }
        });
    }

    // Payment: text instead of photo
    if (user.step === 'WAIT_FOR_PAYMENT' && ctx.message.text) {
        const product = getProduct(user.pending_product_id);
        const priceText = product ? product.priceText : '';
        return ctx.reply(
            `Iltimos, to'lov skrinshotini rasm qilib yuboring.\n\n💳 Karta: \`${config.cardNumber}\` (${priceText})`,
            { parse_mode: 'Markdown' }
        );
    }

    // Fallback: show menu
    if (user.step === 'MAIN_MENU' || (user.full_name && user.phone)) {
        return ctx.reply("Quyidagi menyudan foydalaning 👇", mainMenu);
    }
});

// ========== Approve / Reject ==========
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!data || (!data.startsWith('approve_') && !data.startsWith('reject_'))) return;

    const parts = data.split('_');
    const action = parts[0];
    const uid = parts[1];
    const productId = parts[2] || 'prompt';
    const product = getProduct(productId);

    const { data: targetUser } = await supabase.from('users').select('*').eq('id', uid).single();
    if (!targetUser) return ctx.answerCbQuery("User topilmadi");

    if (action === 'approve') {
        try {
            const channel = (product && product.channelId) || config.channelId || config.coreChannelId;
            const link = await ctx.telegram.createChatInviteLink(channel, {
                member_limit: 1,
                expire_date: Math.floor(Date.now() / 1000) + 86400
            });

            const caption = product ? product.successCaption : "🎉 To'lovingiz tasdiqlandi!";
            await ctx.telegram.sendMessage(uid, `${caption}\n\n🔗 ${link.invite_link}`);

            const currentPaid = Array.isArray(targetUser.paid_products) ? targetUser.paid_products : [];
            if (!currentPaid.includes(productId)) currentPaid.push(productId);

            await supabase.from('users').update({
                is_paid: true,
                paid_products: currentPaid,
                pending_product_id: null,
                step: 'MAIN_MENU'
            }).eq('id', uid);

            const newCaption = (ctx.callbackQuery.message.caption || '').replace("🔔 *YANGI TO'LOV*", "✅ *TASDIQLANDI*");
            await ctx.editMessageCaption(newCaption, { parse_mode: 'Markdown' });
            await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        } catch (e) {
            console.error("Approve error:", e);
            await ctx.answerCbQuery("Xatolik! Bot kanalga adminmi?");
            return;
        }
    } else if (action === 'reject') {
        await ctx.telegram.sendMessage(uid, `❌ To'lov tasdiqlanmadi. Admin: ${config.adminUsername}`);
        await supabase.from('users').update({ step: 'MAIN_MENU', pending_product_id: null }).eq('id', uid);
        const newCaption = (ctx.callbackQuery.message.caption || '').replace("🔔 *YANGI TO'LOV*", "❌ *RAD ETILDI*");
        await ctx.editMessageCaption(newCaption, { parse_mode: 'Markdown' });
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    }
    await ctx.answerCbQuery();
});

// ========== Admin Dashboard ==========
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
    res.send(`<!DOCTYPE html><html><head><title>Admin Panel | Login</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body { background: #050505; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }.card { background: rgba(20, 20, 22, 0.6); padding: 40px; border-radius: 20px; border: 1px solid rgba(212, 175, 55, 0.15); text-align: center; width: 100%; max-width: 360px; }h2 { color: #D4AF37; }input { width: 100%; padding: 14px; margin-bottom: 20px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 12px; }button { width: 100%; padding: 14px; background: #D4AF37; color: #000; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; }</style></head><body><div class="card"><h2>2xPREMIUM ADMIN</h2><form method="POST" action="/login"><input type="text" name="username" placeholder="Login" required><input type="password" name="password" placeholder="Parol" required><button type="submit">KIRISH</button></form></div></body></html>`);
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

// Shared dashboard shell (sidebar + main area)
function dashboardShell({ activePage, title, subtitle, content, extraHead = '', extraScripts = '' }) {
    const nav = [
        { id: 'dashboard', label: 'Overview', icon: '◆', href: '/dashboard' },
        { id: 'users', label: 'Users', icon: '◉', href: '/users' },
        { id: 'announcements', label: 'Announcements', icon: '◈', href: '/dashboard#announcements' },
        { id: 'products', label: 'Products', icon: '◇', href: '/dashboard#products' }
    ];
    const navHtml = nav.map(n =>
        `<a href="${n.href}" class="nav-item${n.id === activePage ? ' active' : ''}"><span class="nav-icon">${n.icon}</span>${n.label}</a>`
    ).join('');

    return `<!DOCTYPE html><html><head><title>${title} | 2xPREMIUM</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>${extraHead}<style>
:root{
  --bg:#0a0a0a;
  --sidebar:#070707;
  --surface:#0d0d0d;
  --surface-2:#121212;
  --border:#1c1c1c;
  --border-strong:#262626;
  --text:#ededed;
  --text-muted:#9ca3af;
  --text-dim:#4b5563;
  --brand:#D4AF37;
  --accent:#14b8a6;
  --accent-dim:#0f766e;
  --warning:#f59e0b;
  --danger:#ef4444;
  --success:#14b8a6;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;font-weight:400;font-feature-settings:'cv11','ss01','ss03';-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;min-height:100vh;display:flex;letter-spacing:-0.005em}
a{color:inherit;text-decoration:none}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}

/* Sidebar */
.sidebar{width:232px;background:var(--sidebar);border-right:1px solid var(--border);padding:20px 12px;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;flex-shrink:0}
.brand{display:flex;align-items:center;gap:11px;padding:8px 10px;margin-bottom:28px}
.brand-logo{width:30px;height:30px;border-radius:7px;background:linear-gradient(135deg,var(--brand),#8B7500);display:flex;align-items:center;justify-content:center;color:#000;font-weight:800;font-size:13px;letter-spacing:-0.5px}
.brand-name{font-weight:600;font-size:14px;letter-spacing:-0.2px}
.nav-section{color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:1.4px;padding:0 12px;margin:10px 0 6px;font-weight:600}
.nav-item{display:flex;align-items:center;gap:10px;padding:7px 11px;border-radius:5px;color:var(--text-muted);font-size:12.5px;font-weight:500;transition:all .1s;margin-bottom:1px}
.nav-item:hover{background:#111;color:var(--text)}
.nav-item.active{background:#141414;color:var(--text)}
.nav-icon{width:14px;text-align:center;color:var(--text-dim);font-size:9px}
.nav-item.active .nav-icon{color:var(--accent)}
.sidebar-footer{margin-top:auto;border-top:1px solid var(--border);padding-top:12px}
.sidebar-footer a{display:block;padding:8px 12px;color:var(--text-dim);font-size:12px;border-radius:6px}
.sidebar-footer a:hover{background:#141414;color:var(--text-muted)}

/* Main */
.main{flex:1;display:flex;flex-direction:column;min-width:0}
.topbar{padding:22px 30px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:16px}
.topbar-title h1{font-size:21px;font-weight:600;letter-spacing:-0.6px;color:var(--text)}
.topbar-title .sub{color:var(--text-dim);font-size:11.5px;margin-top:4px;font-weight:400}
.topbar-actions{display:flex;gap:8px}
.btn{padding:8px 14px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text);transition:all .12s;font-family:inherit}
.btn:hover{background:#181818;border-color:var(--border-strong)}
.btn.primary{background:var(--text);color:#000;border-color:var(--text)}
.btn.primary:hover{background:#e5e5e5}
.content{padding:26px 32px;max-width:1400px}

/* KPI */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:28px}
.kpi{background:var(--surface);border:1px solid var(--border);padding:18px 20px;border-radius:8px;transition:border-color .15s}
.kpi:hover{border-color:var(--border-strong)}
.kpi .label{color:var(--text-dim);font-size:10.5px;text-transform:uppercase;letter-spacing:1.3px;font-weight:600}
.kpi .value{font-size:26px;font-weight:600;margin-top:10px;letter-spacing:-0.9px;color:var(--text)}
.kpi .value.accent{color:var(--accent)}
.kpi .value.success{color:var(--accent)}
.kpi .delta{color:var(--accent);font-size:11px;margin-top:6px;font-weight:500}

/* Section titles */
.section-title{color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:1.4px;margin:32px 0 12px;font-weight:600;display:flex;align-items:center;gap:8px}
.section-title::before{content:'';width:3px;height:12px;background:var(--accent);border-radius:2px}

/* Charts */
.charts{display:grid;grid-template-columns:1.7fr 1fr;gap:12px}
.chart-card{background:var(--surface);border:1px solid var(--border);padding:20px;border-radius:10px}
.chart-card h3{color:var(--text-dim);font-size:11px;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:14px;font-weight:600}
.chart-card.full{grid-column:1 / -1}
canvas{max-height:260px}

/* Table */
.table-wrap{background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:10px}
table{width:100%;border-collapse:collapse}
th,td{padding:13px 20px;text-align:left;font-size:12.5px;border-bottom:1px solid var(--border);font-weight:400}
th{background:#090909;color:var(--text-dim);font-size:10px;text-transform:uppercase;letter-spacing:1.3px;font-weight:600}
tr:last-child td{border-bottom:none}
tr:hover td{background:#101010}
td.muted{color:var(--text-dim)}
td.mono{font-family:'JetBrains Mono',monospace;font-size:11.5px}
.status{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.status.sent{color:var(--accent)}
.status.cancelled{color:var(--danger)}
.status.draft{color:var(--warning)}
.status.paid{color:var(--accent)}
.status.unpaid{color:var(--text-dim)}

/* Products grid */
.products-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.product-card{background:var(--surface);border:1px solid var(--border);padding:18px 20px;border-radius:10px;transition:border-color .15s}
.product-card:hover{border-color:var(--border-strong)}
.product-card h4{font-size:14px;font-weight:600;margin-bottom:2px}
.product-card .price{color:var(--accent);font-weight:700;font-size:20px;margin:10px 0;letter-spacing:-0.5px;font-family:'Inter'}
.product-card .sales{color:var(--text-dim);font-size:12px}

/* Responsive */
@media (max-width:900px){
  body{flex-direction:column}
  .sidebar{width:100%;height:auto;position:relative;flex-direction:row;overflow-x:auto;padding:12px;border-right:none;border-bottom:1px solid var(--border)}
  .sidebar .brand{margin-bottom:0;margin-right:20px}
  .nav-section,.sidebar-footer{display:none}
  .nav-item{flex-shrink:0}
  .topbar{padding:16px 20px}
  .content{padding:20px}
  .charts{grid-template-columns:1fr}
}
</style></head><body>

<aside class="sidebar">
  <div class="brand">
    <div class="brand-logo">2x</div>
    <div class="brand-name">2xPREMIUM</div>
  </div>
  <div class="nav-section">Overview</div>
  ${navHtml}
  <div class="sidebar-footer">
    <a href="/login" onclick="document.cookie='auth=;max-age=0'">↗ Chiqish</a>
  </div>
</aside>

<main class="main">
  <div class="topbar">
    <div class="topbar-title">
      <h1>${title}</h1>
      <div class="sub">${subtitle}</div>
    </div>
    <div class="topbar-actions">
      <button class="btn" onclick="location.reload()">↻ Yangilash</button>
    </div>
  </div>
  <div class="content">${content}</div>
</main>

${extraScripts}
</body></html>`;
}

app.get('/dashboard', checkAuth, async (req, res) => {
    try {
        const [usersRes, annRes] = await Promise.all([
            supabase.from('users').select('*'),
            supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(20)
        ]);
        const users = usersRes.data || [];
        const announcements = annRes.data || [];

        // KPIs
        const total = users.length;
        const paid = users.filter(u => u.is_paid).length;
        const conversion = total > 0 ? ((paid / total) * 100).toFixed(1) : '0.0';

        // Revenue + sales-by-product
        let revenue = 0;
        const salesByProduct = {};
        users.forEach(u => {
            if (Array.isArray(u.paid_products)) {
                u.paid_products.forEach(pid => {
                    const p = getProduct(pid);
                    if (p) {
                        revenue += p.price;
                        salesByProduct[pid] = (salesByProduct[pid] || 0) + 1;
                    }
                });
            }
        });

        // Funnel
        const funnel = {
            started: total,
            named: users.filter(u => u.full_name).length,
            phoned: users.filter(u => u.phone).length,
            attempted: users.filter(u => u.pending_product_id || u.is_paid).length,
            paid: paid
        };

        // Daily signups — last 30 days
        const today = new Date();
        const days = [];
        const counts = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            days.push(key.slice(5));
            counts.push(users.filter(u => u.joined_at && u.joined_at.startsWith(key)).length);
        }

        // Sales by product name
        const productSales = Object.entries(salesByProduct).map(([pid, count]) => {
            const p = getProduct(pid);
            return { name: p ? p.title : pid, count };
        });
        if (productSales.length === 0) productSales.push({ name: 'Hozircha sotuvlar yo\'q', count: 1 });

        // Announcement history rows
        const annRows = announcements.map(a => {
            const caption = (a.caption || '—').replace(/[<>]/g, '').slice(0, 70);
            const target = `${a.target || '—'}${a.target_product_id ? ' · ' + a.target_product_id : ''}`;
            const status = a.status || 'draft';
            const when = a.created_at ? new Date(a.created_at).toLocaleString() : '—';
            return `<tr><td class="muted">#${a.id}</td><td><span class="status ${status}">${status}</span></td><td>${target}</td><td>${caption}</td><td class="muted">${a.sent_count || 0} / ${a.failed_count || 0}</td><td class="muted">${when}</td></tr>`;
        }).join('') || `<tr><td colspan="6" style="text-align:center;color:#555;padding:40px;">Hali e'lonlar yo'q</td></tr>`;

        // Product cards
        const productCards = getActiveProducts().map(p => {
            const sold = salesByProduct[p.id] || 0;
            return `<div class="product-card"><h4>${p.emoji} ${p.title}</h4><div class="price">${p.priceText}</div><div class="sales">🛒 ${sold} ta sotilgan · kanal: ${p.channelId}</div></div>`;
        }).join('');

        const content = `
<div class="kpis">
  <div class="kpi"><div class="label">Total users</div><div class="value">${total}</div></div>
  <div class="kpi"><div class="label">Paid</div><div class="value success">${paid}</div></div>
  <div class="kpi"><div class="label">Conversion</div><div class="value accent">${conversion}%</div></div>
  <div class="kpi"><div class="label">Revenue</div><div class="value accent">${revenue.toLocaleString()} <span style="font-size:14px;color:var(--text-dim);font-weight:500">UZS</span></div></div>
</div>

<div class="charts">
  <div class="chart-card"><h3>Kunlik ro'yxatdan o'tish · 30 kun</h3><canvas id="signupsChart"></canvas></div>
  <div class="chart-card"><h3>Konversiya voronkasi</h3><canvas id="funnelChart"></canvas></div>
</div>

<div class="chart-card full" style="margin-top:14px"><h3>Mahsulotlar bo'yicha sotuvlar</h3><canvas id="salesChart" style="max-height:240px"></canvas></div>

<div id="products" class="section-title">Products</div>
<div class="products-grid">${productCards}</div>

<div id="announcements" class="section-title">Recent Announcements</div>
<div class="table-wrap">
  <table>
    <thead><tr><th>ID</th><th>Status</th><th>Target</th><th>Caption</th><th>Sent / Failed</th><th>Created</th></tr></thead>
    <tbody>${annRows}</tbody>
  </table>
</div>
`;

        const scripts = `<script>
Chart.defaults.color='#52525b';
Chart.defaults.borderColor='#1f1f1f';
Chart.defaults.font.family='Inter,-apple-system,BlinkMacSystemFont,sans-serif';
Chart.defaults.font.size=11;

new Chart(document.getElementById('signupsChart'),{
  type:'line',
  data:{labels:${JSON.stringify(days)},datasets:[{label:'New users',data:${JSON.stringify(counts)},borderColor:'#14b8a6',backgroundColor:'rgba(6,182,212,0.08)',fill:true,tension:0.35,pointRadius:0,pointHoverRadius:4,borderWidth:2}]},
  options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0,color:'#52525b'},grid:{color:'#1a1a1a'}},x:{ticks:{color:'#52525b'},grid:{display:false}}}}
});

new Chart(document.getElementById('funnelChart'),{
  type:'bar',
  data:{labels:['Started','Name','Phone','Tried','Paid'],datasets:[{data:[${funnel.started},${funnel.named},${funnel.phoned},${funnel.attempted},${funnel.paid}],backgroundColor:['#1f1f1f','#2d2d2d','#3a3a3a','#0f766e','#14b8a6'],borderRadius:3,borderSkipped:false}]},
  options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0,color:'#52525b'},grid:{color:'#1a1a1a'}},y:{ticks:{color:'#a1a1aa'},grid:{display:false}}}}
});

new Chart(document.getElementById('salesChart'),{
  type:'doughnut',
  data:{labels:${JSON.stringify(productSales.map(s => s.name))},datasets:[{data:${JSON.stringify(productSales.map(s => s.count))},backgroundColor:['#14b8a6','#0f766e','#3a3a3a','#1f1f1f'],borderWidth:0}]},
  options:{cutout:'68%',plugins:{legend:{position:'right',labels:{color:'#a1a1aa',font:{size:12,family:'Inter'}}}}}
});
</script>`;

        res.send(dashboardShell({
            activePage: 'dashboard',
            title: 'Overview',
            subtitle: `Yangilangan: ${new Date().toLocaleString()}`,
            content,
            extraScripts: scripts
        }));
    } catch (e) {
        console.error('Dashboard error:', e);
        res.status(500).send(`<pre style="color:#fff;background:#000;padding:20px;">Dashboard xatosi: ${e.message}</pre>`);
    }
});

app.get('/users', checkAuth, async (req, res) => {
    const { data: users } = await supabase
        .from('users')
        .select('*')
        .order('joined_at', { ascending: false })
        .limit(300);
    const rows = (users || []).map(u => {
        const prods = Array.isArray(u.paid_products) && u.paid_products.length > 0 ? u.paid_products.join(', ') : '—';
        const name = (u.full_name || u.name || '—').replace(/[<>]/g, '');
        const username = u.username ? '@' + u.username.replace(/[<>]/g, '') : '—';
        const statusClass = u.is_paid ? 'paid' : 'unpaid';
        const statusText = u.is_paid ? 'paid' : 'unpaid';
        const when = u.joined_at ? new Date(u.joined_at).toLocaleString() : '—';
        return `<tr><td class="muted">${u.id}</td><td>${name}</td><td class="muted">${username}</td><td>${u.phone || '—'}</td><td><span class="status ${statusClass}">${statusText}</span></td><td class="muted">${prods}</td><td class="muted">${when}</td></tr>`;
    }).join('');

    const content = `
<div class="table-wrap">
  <table>
    <thead><tr><th>ID</th><th>Name</th><th>Username</th><th>Phone</th><th>Status</th><th>Products</th><th>Joined</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#555;padding:40px;">Hali foydalanuvchilar yo\'q</td></tr>'}</tbody>
  </table>
</div>`;

    res.send(dashboardShell({
        activePage: 'users',
        title: 'Users',
        subtitle: `${(users || []).length} ta foydalanuvchi ko'rsatilmoqda`,
        content
    }));
});

app.get('/', (req, res) => res.redirect('/dashboard'));

// --- Track channel joins (Phase 2 analytics) ---
// Logs a `channel_joined` event when an approved user joins the private
// product channel via their one-time invite link. Requires the bot to be
// an admin of the channel AND `chat_member` in allowed_updates below.
bot.on('chat_member', async (ctx) => {
    try {
        const upd = ctx.update.chat_member;
        const chat = upd.chat;
        const next = upd.new_chat_member;
        const prev = upd.old_chat_member;

        const joinedNow =
            ['member', 'administrator', 'creator'].includes(next.status) &&
            ['left', 'kicked', 'restricted'].includes(prev.status);
        if (!joinedNow) return;

        const products = getActiveProducts();
        const product = products.find(
            (p) => String(p.channelId) === String(chat.id)
        );
        if (!product) return;

        await supabase.from('user_events').insert({
            user_id: String(next.user.id),
            event_type: 'channel_joined',
            product_id: product.id,
            metadata: {
                chat_id: chat.id,
                chat_title: chat.title,
                username: next.user.username || null,
            },
        });
    } catch (err) {
        console.error('chat_member handler failed:', err);
    }
});

// --- Launch ---
const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL;
const ALLOWED_UPDATES = ['message', 'callback_query', 'chat_member'];

if (WEBHOOK_URL) {
    bot.telegram
        .setWebhook(`${WEBHOOK_URL}/bot`, { allowed_updates: ALLOWED_UPDATES })
        .then(() => {
            console.log(`✅ Webhook set: ${WEBHOOK_URL}/bot`);
        });
    app.use(bot.webhookCallback('/bot'));
    app.listen(PORT, () => console.log(`Server on port ${PORT}`));
} else {
    app.listen(PORT, () => console.log(`Server on port ${PORT}`));
    bot.launch({ allowedUpdates: ALLOWED_UPDATES });
}

process.once('SIGINT', () => { try { bot.stop('SIGINT'); } catch (e) {} });
process.once('SIGTERM', () => { try { bot.stop('SIGTERM'); } catch (e) {} });
