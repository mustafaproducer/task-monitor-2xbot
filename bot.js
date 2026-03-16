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
let db = { users: {} };
const DB_FILE = './users.json';

// Render uchun Port ochish (Web Service xatosini oldini olish)


// --- ADMIN DASHBOARD (EXPRESS) ---
const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const DASHBOARD_USER = process.env.DASHBOARD_USER || '2xstat';
const DASHBOARD_PASS = process.env.DASHBOARD_PASS || 'saleofprompts';
const AUTH_TOKEN = 'secret_2x_premium_token';

// Himoya (Auth)
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
        @font-face { font-family: 'Radnika Next'; src: local('Radnika Next'), local('Helvetica Neue'), local('Inter'), sans-serif; }
        body { background: #050505; color: #fff; font-family: 'Radnika Next', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: rgba(20, 20, 22, 0.6); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 40px; border-radius: 20px; border: 1px solid rgba(212, 175, 55, 0.15); box-shadow: 0 15px 35px rgba(0,0,0,0.5); text-align: center; width: 100%; max-width: 360px; }
        h2 { color: #D4AF37; margin-bottom: 30px; letter-spacing: 2px; font-weight: 600; text-transform: uppercase; }
        input { width: 100%; padding: 14px; margin-bottom: 20px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 12px; box-sizing: border-box; outline: none; font-size: 16px; transition: 0.3s; }
        input:focus { border-color: #D4AF37; box-shadow: 0 0 10px rgba(212,175,55,0.2); }
        button { width: 100%; padding: 14px; background: linear-gradient(135deg, #D4AF37, #AA8222); color: #000; border: none; border-radius: 12px; font-weight: 700; font-size: 16px; letter-spacing: 1px; cursor: pointer; transition: 0.3s; }
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
    try {
        // Fallback for db and db.users
        if (typeof db === 'undefined') { var db = { users: {} }; }
        if (!db.users) db.users = {};
        
        const usersArray = Object.values(db.users) || [];
        const totalUsers = usersArray.length;
        const paidUsers = usersArray.filter(u => u && u.isPaid).length;
        const conversion = totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : 0;
        const revenue = paidUsers * 57000;

        let rows = '';
        usersArray.slice().reverse().forEach(u => {
            if (!u) return;
            let dateStr = '-';
            try {
                if (u.joinedAt) dateStr = new Date(u.joinedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
            } catch (e) {
                dateStr = 'Xato sana';
            }
            
            const status = u.isPaid ? '<span class="status-badge status-paid">TO\'LOV QILDI</span>' : '<span class="status-badge status-wait">KUTMOQDA</span>';
            rows += `<tr>
                <td>${u.id || '-'}</td>
                <td>${u.fullName || u.tgName || 'Kiritmadi'}</td>
                <td>${u.tgUsername ? '@'+u.tgUsername : '-'}</td>
                <td>${u.phone || '-'}</td>
                <td>${status}</td>
                <td>${dateStr}</td>
            </tr>`;
        });

        res.send(`
        <!DOCTYPE html>
        <html><head><title>Dashboard | 57 Premium Prompt</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            @font-face { font-family: 'Radnika Next'; src: local('Radnika Next'), local('Helvetica Neue'), local('Inter'), sans-serif; font-weight: normal; }
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
            :root {
                --bg-color: #050505;
                --glass-bg: rgba(20, 20, 22, 0.6);
                --glass-border: rgba(212, 175, 55, 0.15);
                --glass-highlight: rgba(255, 255, 255, 0.05);
                --gold-primary: #D4AF37;
                --text-main: #F3F4F6;
                --text-muted: #9CA3AF;
            }
            
            body { 
                background: radial-gradient(circle at top right, #111115, var(--bg-color) 60%);
                color: var(--text-main); 
                font-family: 'Radnika Next', 'Inter', sans-serif; 
                margin: 0; padding: 40px 20px; min-height: 100vh;
                -webkit-font-smoothing: antialiased;
            }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 25px; margin-bottom: 40px; }
            h1 { color: var(--text-main); margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; background: linear-gradient(to right, #fff, #aaa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .logout { color: var(--text-muted); text-decoration: none; padding: 10px 24px; background: var(--glass-bg); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 30px; transition: all 0.4s ease; font-weight: 500; font-size: 14px; }
            .logout:hover { background: rgba(255,255,255,0.05); color: #fff; border-color: rgba(255,255,255,0.2); box-shadow: 0 0 15px rgba(255,255,255,0.05); }
            
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-bottom: 50px; }
            .card { background: var(--glass-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 30px 25px; border-radius: 20px; border: 1px solid var(--glass-border); border-top: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.3); transition: all 0.4s ease; position: relative; overflow: hidden; }
            .card:hover { transform: translateY(-5px); border-color: rgba(212, 175, 55, 0.4); box-shadow: 0 15px 40px rgba(0,0,0,0.4), 0 0 20px rgba(212, 175, 55, 0.1); }
            .card h3 { margin: 0 0 15px 0; font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500; }
            .card .value { font-size: 38px; font-weight: 700; color: var(--text-main); letter-spacing: -0.5px; }
            .card .value.gold { background: linear-gradient(135deg, #F3E5AB, #D4AF37, #AA8222); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 20px rgba(212,175,55,0.2); }
            .card .value.green { color: #34d399; text-shadow: 0 0 15px rgba(52,211,153,0.2); }
            
            h2.table-title { color: var(--text-main); margin-bottom: 24px; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
            .table-card { background: var(--glass-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th, td { padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.03); }
            th { background: rgba(0,0,0,0.2); color: var(--text-muted); font-weight: 500; text-transform: uppercase; font-size: 11px; letter-spacing: 1.5px; }
            tr { transition: background 0.3s; }
            tr:hover { background: rgba(255,255,255,0.02); }
            td { font-size: 14px; font-weight: 400; color: #d1d5db; }
            .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; display: inline-block; }
            .status-paid { background: rgba(52,211,153,0.1); color: #34d399; border: 1px solid rgba(52,211,153,0.2); }
            .status-wait { background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2); }
            .table-container { overflow-x: auto; }
            
            @media (max-width: 768px) { .header { flex-direction: column; gap: 20px; text-align: center; } .grid { grid-template-columns: 1fr 1fr; } body { padding: 20px 10px; } }
            @media (max-width: 480px) { .grid { grid-template-columns: 1fr; } }
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
    } catch (error) {
        console.error('DASHBOARD ERROR:', error);
        res.status(500).send(`<h1>Xatolik yuz berdi</h1><p>${error.message}</p>`);
    }
});

app.listen(PORT, () => {
    console.log(`Dashboard Server running on port ${PORT}`);
});
// --- END ADMIN DASHBOARD ---
