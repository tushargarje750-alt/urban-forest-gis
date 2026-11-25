-- Database setup for the Flask backend (app.py).
--
-- 1) Create the database. The name is case-sensitive and app.py connects to "TREE",
--    so keep the double quotes:
--        psql -U postgres -c 'CREATE DATABASE "TREE";'
-- 2) Run this file inside it:
--        psql -U postgres -d TREE -f db/schema.sql
--
-- The per-project tables ("<project>_trees") are created automatically by
-- app/sharanga.py when a project is processed, so they are not defined here.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Accounts used by POST /register and POST /login_page.
-- Passwords are stored as Werkzeug hashes (about 160 characters), hence TEXT.
CREATE TABLE IF NOT EXISTS users (
    id       SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- Project names used by POST /add_project and GET /projects.
-- UNIQUE is required: /add_project uses INSERT ... ON CONFLICT (name) DO NOTHING.
CREATE TABLE IF NOT EXISTS projects (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
