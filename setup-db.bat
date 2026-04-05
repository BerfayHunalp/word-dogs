@echo off
cd /d "C:\Users\ISIM NICE\wardogs"
echo Creating users table...
call npx wrangler d1 execute wardogs-db --remote --command="CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT, last_login TEXT)"
echo Creating scores table...
call npx wrangler d1 execute wardogs-db --remote --command="CREATE TABLE scores (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, score INTEGER NOT NULL, level INTEGER DEFAULT 1, words_found INTEGER DEFAULT 0, best_word TEXT, played_at TEXT)"
echo Creating indexes...
call npx wrangler d1 execute wardogs-db --remote --command="CREATE INDEX idx_scores_user ON scores(user_id)"
call npx wrangler d1 execute wardogs-db --remote --command="CREATE INDEX idx_scores_score ON scores(score DESC)"
echo Done!
pause
