// 2xPREMIUM — Product Catalog
// Add new products here. Set `active: false` to hide without deleting.

const products = {
    prompt: {
        id: 'prompt',
        active: true,
        title: "57 ta Premium Promptlar",
        emoji: "💎",
        price: 599000,
        priceText: "599,000 so'm",
        channelId: process.env.CHANNEL_ID || '-1002947739734',
        poster: 'poster.png',
        shortDescription: "Instagram kontent yaratuvchilar uchun 57 ta eng sara Premium Promptlar to'plami.",
        fullDescription:
            "💎 *57 ta Premium Promptlar to'plami*\n\n" +
            "📱 Instagram'da kontent qiluvchilar uchun maxsus tayyorlangan\n" +
            "✨ Kontent ishlab chiqarishni 2x tezlashtiradi\n" +
            "🎯 Professional natijalar uchun sinab ko'rilgan\n" +
            "🔒 Umrbod kirish huquqi\n\n" +
            "💎 Narxi: *599,000 so'm*",
        successCaption:
            "🎉 Tabriklaymiz! Siz 57 ta Premium Promptlarni qo'lga kiritdingiz!\n\n" +
            "Quyidagi bir martalik havola orqali yopiq kanalga qo'shiling 👇\n" +
            "⚠️ Havola 24 soatdan keyin ishlamaydi."
    }

    // Avatar video course — hidden for now, enable when ready.
    // avatar: {
    //     id: 'avatar',
    //     active: false,
    //     title: "Avatar Video Kursi",
    //     emoji: "🎬",
    //     price: 0,
    //     priceText: "0 so'm",
    //     channelId: '',
    //     poster: 'avatar_poster.png',
    //     shortDescription: "...",
    //     fullDescription: "...",
    //     successCaption: "..."
    // }
};

function getProduct(id) {
    return products[id] || null;
}

function getActiveProducts() {
    return Object.values(products).filter(p => p.active);
}

module.exports = { products, getProduct, getActiveProducts };
