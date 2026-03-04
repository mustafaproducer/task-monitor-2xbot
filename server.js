const fs = require('fs');
const http = require('http');
const path = require('path');

const DB_FILE = path.join(__dirname, 'tasks.json');
const PORT = 3000;

// Helper: Read tasks
const readTasks = () => {
    if (!fs.existsSync(DB_FILE)) return [];
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
};

// Helper: Write tasks
const writeTasks = (tasks) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(tasks, null, 2));
};

const server = http.createServer((req, res) => {
    // Enable CORS for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/api/tasks' && req.method === 'GET') {
        const tasks = readTasks();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(tasks));
    } 
    else if (req.url === '/api/tasks' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const newTask = JSON.parse(body);
            const tasks = readTasks();
            tasks.push(newTask);
            writeTasks(tasks);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(newTask));
        });
    }
    else if (req.url.startsWith('/api/tasks/') && req.method === 'PUT') {
        const id = parseInt(req.url.split('/')[3]);
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const updates = JSON.parse(body);
            let tasks = readTasks();
            tasks = tasks.map(t => t.id === id ? { ...t, ...updates } : t);
            writeTasks(tasks);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
    }
    else if (req.url.startsWith('/api/tasks/') && req.method === 'DELETE') {
        const id = parseInt(req.url.split('/')[3]);
        let tasks = readTasks();
        tasks = tasks.filter(t => t.id !== id);
        writeTasks(tasks);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
    }
    else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
