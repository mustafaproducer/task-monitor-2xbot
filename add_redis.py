import re

with open('bot.js', 'r', encoding='utf-8') as f:
    content = f.read()

redis_init = """
const Redis = require('ioredis');

// Redis ulanishi
const redis = new Redis(process.env.REDIS_URL);
redis.on('error', (err) => console.error('❌ Redis xatosi:', err));
redis.on('connect', () => console.log('🚀 Redis-ga muvaffaqiyatli ulandi!'));

// Redis bilan keshlashtirilgan getDBUser
async function getDBUser(id, first_name, username) {
    const cachedUser = await redis.get(`user:${id}`);
    if (cachedUser) {
        return JSON.parse(cachedUser);
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
    
    // Ma'lumotni 1 soatga keshga saqlash
    await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);
    return user;
}

// Ma'lumot o'zgarganda keshni yangilash uchun yordamchi funksiya
async function saveUser(user) {
    await user.save();
    await redis.set(`user:${user.id}`, JSON.stringify(user), 'EX', 3600);
}
"""

# Eski getDBUser funksiyasini va mongoose ulanishini topamiz
# Va o'rniga yangi redis va mongoose logikasini qo'yamiz

content = re.sub(r'async function getDBUser\(id, first_name, username\) \{.*?\}', '', content, flags=re.DOTALL)
content = content.replace("const User = mongoose.model('User', userSchema);", "const User = mongoose.model('User', userSchema);" + redis_init)

# bot.start va bot.on ichidagi .save() larni saveUser(user) ga almashtirish
content = content.replace("await user.save();", "await saveUser(user);")

with open('bot.js', 'w', encoding='utf-8') as f:
    f.write(content)
