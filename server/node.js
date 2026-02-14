import os from "os";
function GetIPv4() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces))
        for (const iface of interfaces[name])
            if (iface.family === "IPv4" && !iface.internal)
                return iface.address;
    return "127.0.0.1";
}

import express from "express";
import cors from "cors";

import fs from "fs";
import path from "path";

import http from "http";
import { fileURLToPath } from 'url';
import { WebSocketServer } from "ws";

import session from "express-session";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";

import Logger from "./module/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC = JSON.parse(fs.readFileSync("server/config/public.json", "utf8"));
const PRIVATE = JSON.parse(fs.readFileSync("server/config/private.json", "utf8"));

const $ = (function(o, k) {
    if (this.release)
        return o?.rel?.[k] ?? o?.[k] ?? null;
    else
        return o?.dev?.[k] ?? o?.[k] ?? null;
}).bind({ release: PRIVATE.release || false });

const URL = PRIVATE.release ?
    `https://${PUBLIC.server.domain}` :
    `http://${PUBLIC.server.host}:${PUBLIC.server.port}`;

const GET_USER_FOLDER = (function(user) {
    return `server/db/user/${this.release ? "" : "dev."}${user.provider}.${Number(user.id).toString(36)}`;
}).bind({ release: PRIVATE.release || false });

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static("client"));
app.use(express.json({ limit: $(PUBLIC.express, "data_limit") }));
app.use(express.urlencoded({ extended: true, limit: $(PUBLIC.express, "data_limit") }));

app.use(cookieParser());
app.use(session({
    secret: $(PRIVATE.session, "secret"),
    resave: false,
    saveUninitialized: true,
}));

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (typeof origin === 'string') {
            if (/^https:\/\/[a-z0-9-]+\.wikipedia\.org$/.test(origin)) return callback(null, true);

            try {
                if (origin.startsWith(URL)) return callback(null, true);
            } catch (e) { /* ignore */ }

            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

{ // OAuth
    function handle(req, res) {
        const token = jwt.sign(req.user, $(PRIVATE.jwt, "secret"), {
            expiresIn: $(PUBLIC.auth, "expires_in")
        });
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "Strict",
            secure: $(PUBLIC.server, "secure")
        });
        res.redirect(req?.query?.redirect || $(PUBLIC.auth.in, "success"));
    }

    { // Google
        passport.use(new GoogleStrategy({
            clientID: $(PRIVATE.auth.in.google, "id"),
            clientSecret: $(PRIVATE.auth.in.google, "secret"),
            callbackURL: `${URL}$(PUBLIC.auth.in.google, "callback")`
        }, (accessToken, refreshToken, profile, done) => {
            done(null, {
                id: profile.id,
                email: profile.emails?.[0]?.value,
                name: profile.displayName || profile.name?.givenName || profile.name?.familyName,
                username: null, // Google does not provide a username
                avatar: profile.photos?.[0]?.value,
                provider: "Google"
            });
        }));

        app.get($(PUBLIC.auth.in.google, "route"), passport.authenticate("google", {
            scope: $(PUBLIC.auth.in.google, "scope"),
        }));
        app.get($(PUBLIC.auth.in.google, "callback"), passport.authenticate("google", {
            // session: false,
            failureRedirect: $(PUBLIC.auth.in, "failure")
        }), handle);
    }
    { // GitHub
        passport.use(new GitHubStrategy({
            clientID: $(PRIVATE.auth.in.github, "id"),
            clientSecret: $(PRIVATE.auth.in.github, "secret"),
            callbackURL: `${URL}$(PUBLIC.auth.in.github, "callback")`
        }, (accessToken, refreshToken, profile, done) => {
            done(null, {
                id: profile.id,
                email: profile.emails?.[0]?.value,
                name: profile.displayName || profile.username,
                username: profile.username,
                avatar: profile.photos?.[0]?.value,
                provider: "GitHub",
            });
        }));

        app.get($(PUBLIC.auth.in.github, "route"), passport.authenticate("github", {
            scope: $(PUBLIC.auth.in.github, "scope"),
        }));
        app.get($(PUBLIC.auth.in.github, "callback"), passport.authenticate("github", {
            // session: false,
            failureRedirect: $(PUBLIC.auth.in, "failure"),
        }), handle);
    }
}

{ // WebSocket
    function parse_cookies(header) {
        const cookies = {};
        if (!header) return cookies;

        header.split(";").forEach(cookie => {
            const [ name, ...rest ] = cookie.trim().split("=");
            cookies[name] = decodeURIComponent(rest.join("="));
        });

        return cookies;
    }

    wss.on("connection", (ws, req) => {
        /* const token = parse_cookies(req.headers.cookie || "").token;
        if (!token) return ws.close(1008, "Unauthorized");

        let user;
        try {
            user = jwt.verify(token, $(PRIVATE.jwt, "secret"));
        } catch (err) { return ws.close(1008, "Unauthorized"); } */

        ws.on("message", async message => {
            try {
                message = JSON.parse(message);
                switch (message.for) {
                    case "server-logger": {
                        Logger.log(message.type, message.message, message.stack);
                        console.log("Server Logger Message:", message);
                    } break;
                    default:
                    case "global": {
                        switch (message.type) {
                            case "ping": {
                                ws.send(JSON.stringify({ type: "pong" }));
                            } break;
                            case "sync": {
                                ws.send(JSON.stringify({ type: "sync", time: Date.now() }));
                            } break;
                            case "user": {
                                ws.send(JSON.stringify({ type: "user", user }));
                            } break;
                        }
                    } break;
                    case "terrarian": {
                        switch (message.type) {
                            case "hash": {
                                read_or(`${GET_USER_FOLDER(user)}/save_hash.txt`, "utf8", "", [ "type=hash", "onmessage", "websocket" ])
                                    .then(data => {
                                        if (typeof data !== "object") Logger.log("ERROR", `Invalid data type: ${typeof data}`, [ "then", "type=hash", "onmessage", "websocket" ]);
                                        ws.send(JSON.stringify({ type: "hash", hash: data.data || "" }));
                                    })
                                    .catch(data => {
                                        if (typeof data !== "object") Logger.log("ERROR", `Invalid data type: ${typeof data}`, [ "catch", "type=hash", "onmessage", "websocket" ]);
                                        else Logger.log("ERROR", `Failed to read hash file: ${data.error}`, [ "catch", "type=hash", "onmessage", "websocket" ]);
                                        ws.send(JSON.stringify({ type: "error", error: data.error || "Internal server error" }));
                                    });
                            } break;
                        }
                    } break;
                }
            } catch (err) { return ws.close(1008, "Invalid message format"); }
        });
    });
}

app.get($(PUBLIC.auth.out, "route"), (req, res) => {
    res.clearCookie("token");
    res.redirect($(PUBLIC.auth.out, "success"));
});

app.get($(PUBLIC.auth.delete, "route"), (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).send("Unauthorized");

    const folder = GET_USER_FOLDER(user);
    fs.promises.rm(folder, { recursive: true, force: true })
        .then(() => {
            res.clearCookie("token");
            res.redirect($(PUBLIC.auth.delete, "success"));
        })
        .catch(err => {
            Logger.log("ERROR", `Failed to delete user folder ${folder}: ${err.message}`, [ $(PUBLIC.auth.delete, "route"), "app.get" ]);
            res.status(500).send("Internal server error");
        });
});

{
    const callbacks = { };

    const rateLimitStores = new Map();
    function getRateLimiter(domainKey, config) {
        if (!config) return null;
        if (!rateLimitStores.has(domainKey)) rateLimitStores.set(domainKey, new Map());
        const store = rateLimitStores.get(domainKey);
        const windowMs = Number(config.window_ms || 60000);
        const max = Number(config.max || 60);

        return function allow(ip) {
            const now = Date.now();
            const cutoff = now - windowMs;
            const arr = store.get(ip) ?? [];
            // prune old timestamps from the front
            let i = 0;
            while (i < arr.length && arr[i] < cutoff) i++;
            if (i > 0) arr.splice(0, i);

            if (arr.length >= max) {
                // still over the limit
                store.set(ip, arr);
                return false;
            }

            arr.push(now);
            store.set(ip, arr);
            return true;
        };
    }

    function ReadDomain(domain, inherit = { }) {
        const domainPath = inherit.name ?? [ ];
        if ((domain.name ?? "") !== "") {
            domainPath.unshift(domain.name);
        }

        const dev = domain.dev ?? inherit.dev ?? false;
        if (Array.isArray(domain.routes)) {
            if (dev && PRIVATE.release) {
                return;
            }

            const domainKey = domainPath.join('.') || '_root';
            const limiter = domain.rate_limit ? getRateLimiter(domainKey, domain.rate_limit) : null;

            for (const route of domain.routes) {
                if (!route.route) {
                    return;
                }

                let handler;
                if (route.type.startsWith("custom:")) {
                    switch (route.type.slice(7)) {
                        case "ping": {
                            handler = (req, res) => {
                                res.send('pong');
                            }
                        } break;

                        case "wikishield-callback": {
                            handler = (req, res) => {
                                const { code, state } = req.query;
                                const deepLink = `wikishield://callback?${code ? `code=${encodeURIComponent(code)}` : ''}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
                                res.send(`
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                        <title>WikiShield - Opening App</title>
                                        <meta http-equiv="refresh" content="0; url=${deepLink}">
                                        <style>
                                            @keyframes fade-in {
                                                from { opacity: 0; }
                                                to { opacity: 1; }
                                            }

                                            @keyframes slide-up {
                                                from { opacity: 0; transform: translateY(20px); }
                                                to { opacity: 1; transform: translateY(0); }
                                            }

                                            @keyframes spin {
                                                0% { transform: rotate(0deg); }
                                                100% { transform: rotate(360deg); }
                                            }

                                            @keyframes glow-pulse {
                                                0%, 100% { box-shadow: 0 0 20px rgba(102, 126, 234, .15); }
                                                50% { box-shadow: 0 0 30px rgba(102, 126, 234, .25); }
                                            }

                                            * {
                                                box-sizing: border-box;
                                            }

                                            body {
                                                margin: 0;
                                                padding: 0;

                                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;

                                                display: flex;
                                                align-items: center;
                                                justify-content: center;

                                                width: 100vw;
                                                min-height: 100vh;

                                                overflow: hidden;

                                                background: linear-gradient(135deg,
                                                    rgba(15, 12, 41, 1),
                                                    rgba(25, 22, 50, 1)
                                                );

                                                color: rgba(245, 247, 255, 1);

                                                animation: fade-in .4s ease-out;
                                            }

                                            .container {
                                                display: flex;
                                                flex-direction: column;
                                                align-items: center;
                                                gap: 16px;

                                                max-width: 400px;
                                                width: 100%;

                                                border-radius: 10px;
                                                border: 1px solid rgba(255, 255, 255, .05);

                                                padding: 32px 24px;

                                                text-align: center;

                                                background: rgba(255, 255, 255, .02);
                                                -webkit-backdrop-filter: blur(10px);
                                                        backdrop-filter: blur(10px);

                                                animation: slide-up .5s ease-out .1s both;
                                            }

                                            .header-icon {
                                                display: block;

                                                margin-bottom: 4px;

                                                font-size: 36px;

                                                background: linear-gradient(135deg,
                                                    rgba(102, 126, 234, 1),
                                                    rgba(118, 75, 162, 1)
                                                );
                                                -webkit-background-clip: text;
                                                        background-clip: text;
                                                -webkit-text-fill-color: transparent;
                                            }

                                            .title {
                                                margin: 0;

                                                font-size: 16px;
                                                font-weight: 600;

                                                color: rgba(245, 247, 255, 1);
                                            }

                                            .spinner {
                                                width: 32px;
                                                height: 32px;

                                                border: 3px solid rgba(255, 255, 255, .08);
                                                border-top: 3px solid rgba(102, 126, 234, 1);
                                                border-radius: 50%;

                                                animation: spin 1s linear infinite;
                                            }

                                            .hint {
                                                margin: 0;

                                                font-size: 12px;
                                                font-weight: 400;

                                                color: rgba(200, 205, 220, .6);
                                            }

                                            .manual-link {
                                                display: inline-flex;
                                                align-items: center;
                                                justify-content: center;
                                                gap: 8px;

                                                padding: 9px 20px;

                                                border-radius: 8px;
                                                border: 1px solid rgba(102, 126, 234, .4);

                                                font-size: 13px;
                                                font-weight: 600;
                                                text-decoration: none;

                                                background: rgba(102, 126, 234, .1);
                                                color: rgba(102, 126, 234, 1);

                                                transition: background .2s ease,
                                                            border-color .2s ease;
                                            }

                                            .manual-link:hover {
                                                background: rgba(102, 126, 234, .2);
                                                border-color: rgba(102, 126, 234, .6);

                                                animation: glow-pulse 2s ease-in-out infinite;
                                            }

                                            .manual-link:active {
                                                transform: scale(.97);
                                            }
                                        </style>
                                        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
                                    </head>
                                    <body>
                                        <div class="container">
                                            <span class="header-icon">
                                                <i class="fas fa-user-circle"></i>
                                            </span>
                                            <p class="title">Opening WikiShield...</p>
                                            <div class="spinner"></div>
                                            <p class="hint">If the app doesn't open automatically:</p>
                                            <a href="${deepLink}" class="manual-link">Click here to open WikiShield</a>
                                        </div>
                                    </body>
                                    </html>
                                `);
                            }
                        } break;
                        case "wikishield-health": {
                            handler = (req, res) => {
                                res.json({ status: 'ok', service: 'wikishield-oauth-callback' });
                            }
                        } break;
                    }
                } else
                    switch (route.type) {
                        case "file": {
                            handler = (req, res) => {
                                res.status(route.status ?? 200);
                                res.render(route.data.path);
                            };
                        } break;
                        case "static": {
                            handler = (req, res) => {
                                res.status(route.status ?? 200);
                                res.sendFile(path.resolve(route.data.path));
                            };
                        } break;
                        case "redirect": {
                            handler = (req, res) => {
                                res.status(route.status ?? 301);
                                if ("url" in route.data)
                                    res.redirect(route.data.url);
                                else if ("path" in route.data)
                                    res.render(route.data.path);
                                else
                                    res.status(400).json({ error: "Invalid redirect data" });
                            };
                        } break;
                        case "json": {
                            handler = (req, res) => {
                                res.status(route.status ?? 200);
                                fs.readFile(path.resolve(route.data.path), "utf8", (err, data) => {
                                    if (err) {
                                        res.status(500).json({ error: err });
                                    } else {
                                        try {
                                            const jsonData = JSON.parse(data);
                                            res.json(jsonData);
                                        } catch (parseErr) {
                                            res.status(500).json({ error: parseErr });
                                        }
                                    }
                                });
                            };
                        } break;
                    }

                if (handler) {
                    callbacks[route.route] ??= [ ];
                    callbacks[route.route].push((req, res, next) => {
                        let subdomains = req.subdomains;
                        if (req.query.subdomain) {
                            subdomains = req.query.subdomain
                                .split(".")
                                .reverse();
                        }

                        if (domainPath.length === subdomains.length && domainPath.every((label, i) => label === subdomains[i])) { /* correct subdomain */
                            if (limiter) {
                                const ip = req.ip || req.connection?.remoteAddress || (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || 'unknown';
                                if (!limiter(ip)) {
                                    res.setHeader('Retry-After', Math.ceil((Number(domain.rate_limit.window_ms || 60000) / 1000)));
                                    return res.status(429).json({ error: 'Rate limit exceeded' });
                                }
                            }

                            handler(req, res);
                        } else {
                            next();
                        }
                    });
                }
            }
        }

        if (Array.isArray(domain.domains)) {
            for (const sub of domain.domains) {
                if (typeof sub === "object" && sub !== null) {
                    ReadDomain(sub, { name: [ ...domainPath ], dev });
                }
            }
        }
    }

    ReadDomain(PUBLIC.router);

    for (const [ path, handlers ] of Object.entries(callbacks)) {
        app.get(path, ...handlers);
    }
}

app.use((req, res) => {
    if (req.path.endsWith(".svg"))
        res.status(404).redirect("/null.svg");
    else res.status(404).send("404 Not Found");
});

const host = $(PUBLIC.server, "host");
server.listen($(PUBLIC.server, "port"), host, () => {
    const realURL = URL.replace(/^(https?:\/\/)0\.0\.0\.0\b/, `$1${GetIPv4()}`);
    console.log(`Server running at ${realURL}`);
    console.log(`WebSocket server running at ${realURL.replace(/^http/, "ws")}`);
});
