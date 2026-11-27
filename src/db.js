const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "guru.sqlite");
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    coins INTEGER NOT NULL DEFAULT 0,
    free_packs INTEGER NOT NULL DEFAULT 0,
    daily_at INTEGER NOT NULL DEFAULT 0,
    work_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS consents (
    user_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    consented_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_user_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    club TEXT NOT NULL,
    position TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 60 AND 99),
    rarity TEXT NOT NULL DEFAULT 'bronze',
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (discord_user_id) REFERENCES consents(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT NOT NULL,
    player_id INTEGER NOT NULL,
    acquired_at INTEGER NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_cards_owner ON cards(owner_id);
  CREATE INDEX IF NOT EXISTS idx_players_active ON players(active);
`);

const statements = {
  ensureUser: db.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)"),
  getUser: db.prepare("SELECT * FROM users WHERE user_id = ?"),
  daily: db.prepare("UPDATE users SET coins = coins + 200, free_packs = free_packs + 1, daily_at = ? WHERE user_id = ?"),
  work: db.prepare("UPDATE users SET coins = coins + ?, work_at = ? WHERE user_id = ?"),
  spend: db.prepare("UPDATE users SET coins = coins - ? WHERE user_id = ? AND coins >= ?"),
  addCoins: db.prepare("UPDATE users SET coins = coins + ? WHERE user_id = ?"),
  useFreePack: db.prepare("UPDATE users SET free_packs = free_packs - 1 WHERE user_id = ? AND free_packs > 0"),
  consent: db.prepare("INSERT INTO consents (user_id, display_name, consented_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name, consented_at = excluded.consented_at"),
  getConsent: db.prepare("SELECT * FROM consents WHERE user_id = ?"),
  addPlayer: db.prepare("INSERT INTO players (discord_user_id, name, club, position, rating, rarity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"),
  getPlayer: db.prepare("SELECT * FROM players WHERE id = ? AND active = 1"),
  updatePlayer: db.prepare("UPDATE players SET rating = COALESCE(?, rating), rarity = COALESCE(?, rarity), club = COALESCE(?, club), position = COALESCE(?, position) WHERE id = ? AND active = 1"),
  removePlayer: db.prepare("DELETE FROM players WHERE id = ?"),
  players: db.prepare("SELECT * FROM players WHERE active = 1 ORDER BY rating DESC"),
  addCard: db.prepare("INSERT INTO cards (owner_id, player_id, acquired_at) VALUES (?, ?, ?)"),
  collection: db.prepare("SELECT c.id AS card_id, p.id AS player_id, p.name, p.club, p.position, p.rating, p.rarity, c.acquired_at FROM cards c JOIN players p ON p.id = c.player_id WHERE c.owner_id = ? ORDER BY p.rating DESC, c.acquired_at DESC"),
  getCard: db.prepare("SELECT c.id AS card_id, p.rating FROM cards c JOIN players p ON p.id = c.player_id WHERE c.id = ? AND c.owner_id = ?"),
  deleteCard: db.prepare("DELETE FROM cards WHERE id = ? AND owner_id = ?"),
  leaderboard: db.prepare("SELECT u.user_id, u.coins, COUNT(c.id) AS card_count, COALESCE(MAX(p.rating), 0) AS best_rating FROM users u LEFT JOIN cards c ON c.owner_id = u.user_id LEFT JOIN players p ON p.id = c.player_id GROUP BY u.user_id ORDER BY card_count DESC, best_rating DESC, coins DESC LIMIT 10")
};

function ensureUser(userId) {
  statements.ensureUser.run(userId);
  return statements.getUser.get(userId);
}

function getEligiblePlayers(type) {
  const all = statements.players.all();
  if (type === "rare") return all.filter(p => p.rating >= 70);
  if (type === "special") return all.filter(p => p.rating >= 82 || p.rarity === "special" || p.rarity === "promo");
  if (type === "promo") return all.filter(p => p.rating >= 90 || p.rarity === "promo");
  return all;
}

function pickPlayer(players) {
  const weights = players.map(p => p.rarity === "promo" ? 8 : p.rarity === "special" ? 15 : p.rarity === "gold" ? 30 : p.rarity === "silver" ? 55 : 80);
  const total = weights.reduce((sum, n) => sum + n, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < players.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return players[i];
  }
  return players[players.length - 1];
}

const transactions = {
  claimDaily(userId, now) {
    const user = ensureUser(userId);
    if (now - user.daily_at < 86400) return { ok: false, remaining: 86400 - (now - user.daily_at) };
    statements.daily.run(now, userId);
    return { ok: true, user: statements.getUser.get(userId) };
  },
  earnWork(userId, now, amount) {
    const user = ensureUser(userId);
    if (now - user.work_at < 3600) return { ok: false, remaining: 3600 - (now - user.work_at) };
    statements.work.run(amount, now, userId);
    return { ok: true, user: statements.getUser.get(userId) };
  },
  openPack(userId, type, now) {
    const user = ensureUser(userId);
    const eligible = getEligiblePlayers(type);
    if (!eligible.length) return { ok: false, reason: "empty" };
    const costs = { normal: 100, rare: 300, special: 750, promo: 1500 };
    let usedFree = false;
    if (type === "normal" && user.free_packs > 0) {
      const result = statements.useFreePack.run(userId);
      usedFree = result.changes === 1;
    }
    if (!usedFree) {
      const cost = costs[type];
      const result = statements.spend.run(cost, userId, cost);
      if (result.changes !== 1) return { ok: false, reason: "coins", cost, balance: user.coins };
    }
    const player = pickPlayer(eligible);
    const card = statements.addCard.run(userId, player.id, now);
    return { ok: true, player, cardId: Number(card.lastInsertRowid), user: statements.getUser.get(userId), usedFree };
  },
  sellCard(userId, cardId) {
    const card = statements.getCard.get(cardId, userId);
    if (!card) return { ok: false };
    const transaction = db.transaction(() => {
      statements.deleteCard.run(cardId, userId);
      const payout = Math.max(25, Math.round(card.rating * 2));
      statements.addCoins.run(payout, userId);
      return payout;
    });
    return { ok: true, payout: transaction() };
  }
};

module.exports = { db, statements, ensureUser, getEligiblePlayers, transactions };
