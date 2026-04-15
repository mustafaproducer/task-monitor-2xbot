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

async function saveUser(user) {
    try {
        const { error } = await supabase.from('users').update(user).eq('id', user.id);
        if (error) console.error(`[saveUser] Error:`, error.message);
    } catch (err) {
        console.error("saveUser Error:", err.message);
    }
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

app.get('/dashboard', checkAuth, async (req, res) => {
    const { data: users } = await supabase.from('users').select('*').order('joined_at', { ascending: false }).limit(100);
    const { count: total } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: paid } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_paid', true);

    const rows = users.map(u => {
        const prods = Array.isArray(u.paid_products) && u.paid_products.length > 0 ? u.paid_products.join(', ') : '-';
        return `<tr><td>${u.id}</td><td>${u.full_name || u.name}</td><td>${u.username ? '@' + u.username : '-'}</td><td>${u.phone || '-'}</td><td>${u.is_paid ? 'HA' : 'YOQ'}</td><td>${prods}</td><td>${u.joined_at ? new Date(u.joined_at).toLocaleString() : '-'}</td></tr>`;
    }).join('');

    res.send(`<!DOCTYPE html><html><head><title>Dashboard</title><style>body{background:#050505;color:#fff;font-family:sans-serif;padding:40px;}table{width:100%;border-collapse:collapse;}th,td{padding:15px;border-bottom:1px solid #333;text-align:left;}.stat{display:flex;gap:20px;margin-bottom:40px;}.card{background:#111;padding:20px;border-radius:10px;border:1px solid #D4AF37;flex:1;}</style></head><body><h1>2xPREMIUM — SOTUVLAR</h1><div class="stat"><div class="card"><h3>Jami</h3><h2>${total}</h2></div><div class="card"><h3>To'laganlar</h3><h2>${paid}</h2></div></div><table><thead><tr><th>ID</th><th>Ism</th><th>User</th><th>Raqam</th><th>To'lov</th><th>Mahsulotlar</th><th>Sana</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
});

app.get('/', (req, res) => res.redirect('/dashboard'));

// --- Launch ---
const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL;

if (WEBHOOK_URL) {
    bot.telegram.setWebhook(`${WEBHOOK_URL}/bot`).then(() => {
        console.log(`✅ Webhook set: ${WEBHOOK_URL}/bot`);
    });
    app.use(bot.webhookCallback('/bot'));
    app.listen(PORT, () => console.log(`Server on port ${PORT}`));
} else {
    app.listen(PORT, () => console.log(`Server on port ${PORT}`));
    bot.launch();
}

process.once('SIGINT', () => { try { bot.stop('SIGINT'); } catch (e) {} });
process.once('SIGTERM', () => { try { bot.stop('SIGTERM'); } catch (e) {} });
