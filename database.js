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
        dob TEXT,
        diamonds INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        vip_expires_at DATETIME,
        matches_today INTEGER DEFAULT 0,
        last_reset_date TEXT,
        stripe_customer_id TEXT,
        photoURL TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Users table ready.');
            // Migration: Add dob column if it doesn't exist
            db.run(`ALTER TABLE users ADD COLUMN dob TEXT`, (err) => { });
            // Migration: Add vip_expires_at column if it does not exist
            db.run(`ALTER TABLE users ADD COLUMN vip_expires_at DATETIME`, (err) => { });
            // Migration: Add photoURL column if it does not exist
            db.run(`ALTER TABLE users ADD COLUMN photoURL TEXT`, (err) => { });
            // Migration: Add diamonds/coins if missing
            db.run(`ALTER TABLE users ADD COLUMN diamonds INTEGER DEFAULT 0`, (err) => { });
            db.run(`ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0`, (err) => { });
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
            const { id, displayName, email, photo } = user;
            // First check if user exists
            db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
                if (err) return reject(err);

                if (row) {
                    // Update existing
                    db.run(`UPDATE users SET displayName = ?, photoURL = ? WHERE id = ?`,
                        [displayName, photo, id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                } else {
                    // Create new
                    db.run(`INSERT INTO users (id, displayName, photoURL) VALUES (?, ?, ?)`,
                        [id, displayName, photo],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                }
            });
        });
    },

    setVipExpiry: (id, expiryDate) => {
        return new Promise((resolve, reject) => {
            // expiryDate should be ISO string or DB compatible format
            db.run(`UPDATE users SET vip_expires_at = ? WHERE id = ?`, [expiryDate, id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    updateDemographics: (id, gender, dob) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE users SET gender = ?, dob = ? WHERE id = ?`, [gender, dob, id], function (err) {
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
    },

    exchangeCoinsToDiamonds: (id, coinsCost, diamondsReward) => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.get("SELECT coins FROM users WHERE id = ?", [id], (err, row) => {
                    if (err) return reject(err);
                    if (!row || row.coins < coinsCost) return reject(new Error("Insufficient coins"));

                    db.run("UPDATE users SET coins = coins - ?, diamonds = diamonds + ? WHERE id = ?",
                        [coinsCost, diamondsReward, id],
                        function (err) {
                            if (err) reject(err);
                            else resolve({ newCoins: row.coins - coinsCost, newDiamonds: (row.diamonds || 0) + diamondsReward });
                        }
                    );
                });
            });
        });
    }
};

module.exports = { db, User };
