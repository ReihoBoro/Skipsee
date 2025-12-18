const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        displayName TEXT,
        gender TEXT,
        diamonds INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        matches_today INTEGER DEFAULT 0,
        last_reset_date TEXT,
        stripe_customer_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Users table ready.');
        }
    });
}

const User = {
    get: (id) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    createOrUpdate: (user) => {
        return new Promise((resolve, reject) => {
            const { id, displayName } = user;
            db.run(`INSERT INTO users (id, displayName) VALUES (?, ?)
                    ON CONFLICT(id) DO UPDATE SET displayName = excluded.displayName`,
                [id, displayName],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID); // logic to just return success
                });
        });
    },

    updateGender: (id, gender) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE users SET gender = ? WHERE id = ?`, [gender, id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },

    incrementMatches: (id) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE users SET matches_today = matches_today + 1 WHERE id = ?`, [id], function (err) {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    addDiamonds: (id, amount) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE users SET diamonds = diamonds + ? WHERE id = ?`, [amount, id], function (err) {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    addCoins: (id, amount) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE users SET coins = coins + ? WHERE id = ?`, [amount, id], function (err) {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    resetDailyMatches: () => {
        return new Promise((resolve, reject) => {
            const today = new Date().toISOString().split('T')[0];
            db.run(`UPDATE users SET matches_today = 0, last_reset_date = ?`, [today], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }
};

module.exports = { db, User };
