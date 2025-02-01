const express = require('express');
const settings = require('../settings.json');

module.exports.load = async function(app, db) {
    app.post("/api/referral/generate", async (req, res) => {
        try {
            if (!req.session.userinfo) return res.json({ success: false, error: "Not logged in" });
            
            // Check if user already has a referral
            const existingReferral = await db.get(`referral-${req.session.userinfo.id}`);
            if (existingReferral) return res.json({ success: false, error: "You already have an active referral code" });

            // Generate random referral code
            const code = await generateUniqueCode(db);
            
            // Save referral
            await db.set(`referral-${req.session.userinfo.id}`, {
                code: code,
                type: "free",
                created: Date.now()
            });
            
            await db.set(`referralcode-${code.toLowerCase()}`, req.session.userinfo.id);

            res.json({ success: true, code: code });
        } catch (error) {
            console.error('Error generating referral:', error);
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    });

    app.post("/api/referral/custom", async (req, res) => {
        if (!req.session.userinfo) return res.json({ success: false, error: "Not logged in" });
        
        const coins = await db.get(`coins-${req.session.userinfo.id}`) ?? 0;
        if (coins < 200) return res.json({ success: false, error: "Insufficient coins" });

        const code = req.body.code;
        if (!code || code.length < 3 || code.length > 20) {
            return res.json({ success: false, error: "Invalid code format" });
        }

        // Check if code already exists
        const existingCode = await db.get(`referralcode-${code.toLowerCase()}`);
        if (existingCode) return res.json({ success: false, error: "This code is already taken" });

        // Deduct coins
        await db.set(`coins-${req.session.userinfo.id}`, coins - 200);

        // Save referral
        await db.set(`referral-${req.session.userinfo.id}`, {
            code: code,
            type: "custom",
            created: Date.now()
        });
        await db.set(`referralcode-${code.toLowerCase()}`, req.session.userinfo.id);

        res.json({ success: true, code: code });
    });

    app.post("/api/referral/edit", async (req, res) => {
        if (!req.session.userinfo) return res.json({ success: false, error: "Not logged in" });
        
        const coins = await db.get(`coins-${req.session.userinfo.id}`) ?? 0;
        if (coins < 10) return res.json({ success: false, error: "Insufficient coins (10 needed)" });

        const newCode = req.body.code;
        if (!newCode || newCode.length < 3 || newCode.length > 20) {
            return res.json({ success: false, error: "Invalid code format" });
        }

        const existingReferral = await db.get(`referral-${req.session.userinfo.id}`);
        if (!existingReferral || existingReferral.type !== 'custom') {
            return res.json({ success: false, error: "You don't have a custom referral to edit" });
        }

        // Delete old referral code
        await db.delete(`referralcode-${existingReferral.code.toLowerCase()}`);

        // Check if new code exists
        const existingCode = await db.get(`referralcode-${newCode.toLowerCase()}`);
        if (existingCode) return res.json({ success: false, error: "This code is already taken" });

        // Deduct coins
        await db.set(`coins-${req.session.userinfo.id}`, coins - 10);

        // Update referral
        await db.set(`referral-${req.session.userinfo.id}`, {
            code: newCode,
            type: "custom",
            created: Date.now()
        });
        await db.set(`referralcode-${newCode.toLowerCase()}`, req.session.userinfo.id);

        res.json({ success: true, code: newCode });
    });

    app.post("/api/referral/delete", async (req, res) => {
        if (!req.session.userinfo) return res.json({ success: false, error: "Not logged in" });

        const existingReferral = await db.get(`referral-${req.session.userinfo.id}`);
        if (!existingReferral) {
            return res.json({ success: false, error: "You don't have a referral to delete" });
        }

        // Delete referral
        await db.delete(`referralcode-${existingReferral.code.toLowerCase()}`);
        await db.delete(`referral-${req.session.userinfo.id}`);

        res.json({ success: true });
    });

    app.post("/api/referral/redeem", async (req, res) => {
        if (!req.session.userinfo) return res.json({ success: false, error: "Not logged in" });

        const code = req.body.code;
        if (!code) return res.json({ success: false, error: "Invalid code" });

        // Check if user has already redeemed a referral
        const hasRedeemed = await db.get(`referral-redeemed-${req.session.userinfo.id}`);
        if (hasRedeemed) return res.json({ success: false, error: "You have already redeemed a referral code" });

        // Check if code exists
        const ownerId = await db.get(`referralcode-${code.toLowerCase()}`);
        if (!ownerId) return res.json({ success: false, error: "Invalid referral code" });

        // Don't allow self-referral
        if (ownerId === req.session.userinfo.id) {
            return res.json({ success: false, error: "You cannot use your own referral code" });
        }

        // Add coins to both users
        const ownerCoins = await db.get(`coins-${ownerId}`) ?? 0;
        const userCoins = await db.get(`coins-${req.session.userinfo.id}`) ?? 0;

        await db.set(`coins-${ownerId}`, ownerCoins + 50);
        await db.set(`coins-${req.session.userinfo.id}`, userCoins + 50);

        // Mark code as redeemed for this user
        await db.set(`referral-redeemed-${req.session.userinfo.id}`, code);

        res.json({ success: true });
    });

    // Admin endpoints
    app.get("/api/admin/referrals", async (req, res) => {
        if (!req.session.userinfo) return res.json({ success: false, error: "Not logged in" });
        
        // Verify admin status
        const pterodactylId = await db.get("users-" + req.session.userinfo.id);
        const adminCheck = await fetch(
            settings.pterodactyl.domain + "/api/application/users/" + pterodactylId,
            {
                method: "get",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );
        const adminInfo = await adminCheck.json();
        if (!adminInfo.attributes.root_admin) {
            return res.json({ success: false, error: "Unauthorized" });
        }

        try {
            // Método alternativo para obtener referrals
            const referrals = [];
            const prefix = 'referral-';
            
            // Iteramos sobre todas las keys usando promesas
            const keys = await new Promise((resolve, reject) => {
                let allKeys = [];
                db.iterator((err, iterator) => {
                    if (err) return reject(err);
                    
                    function getNext() {
                        iterator.next((err, key, value) => {
                            if (err) return reject(err);
                            if (key === undefined) {
                                iterator.end(err => {
                                    if (err) reject(err);
                                    else resolve(allKeys);
                                });
                                return;
                            }
                            
                            // Solo procesamos keys que empiezan con referral- y no incluyen redeemed
                            if (key.startsWith(prefix) && !key.includes('redeemed')) {
                                const userId = key.replace(prefix, '');
                                const data = typeof value === 'string' ? JSON.parse(value) : value;
                                referrals.push({
                                    userId,
                                    ...data
                                });
                            }
                            getNext();
                        });
                    }
                    getNext();
                });
            });

            res.json({ success: true, referrals });
        } catch (error) {
            console.error('Error fetching referrals:', error);
            console.error(error.stack);
            res.status(500).json({ success: false, error: "Error fetching referrals" });
        }
    });

    app.post("/api/admin/referral/create", async (req, res) => {
        if (!req.session.userinfo) return res.json({ success: false, error: "Not logged in" });
        
        // Verify admin status
        const pterodactylId = await db.get("users-" + req.session.userinfo.id);
        const adminCheck = await fetch(
            settings.pterodactyl.domain + "/api/application/users/" + pterodactylId,
            {
                method: "get",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );
        const adminInfo = await adminCheck.json();
        if (!adminInfo.attributes.root_admin) {
            return res.json({ success: false, error: "Unauthorized" });
        }

        const { userId, code, type } = req.body;
        if (!userId || !code || !type) {
            return res.json({ success: false, error: "Missing required fields" });
        }

        // Check if code already exists
        const existingCode = await db.get(`referralcode-${code.toLowerCase()}`);
        if (existingCode) return res.json({ success: false, error: "This code is already taken" });

        // Save referral
        await db.set(`referral-${userId}`, {
            code: code,
            type: type,
            created: Date.now()
        });
        await db.set(`referralcode-${code.toLowerCase()}`, userId);

        res.json({ success: true, code: code });
    });

    async function generateUniqueCode(db) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const length = 8;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            const code = Array(length).fill()
                .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
                .join('');
            
            // Verificar si el código ya existe
            const exists = await db.get(`referralcode-${code.toLowerCase()}`);
            if (!exists) {
                return code;
            }
            
            attempts++;
        }
        
        // Si después de varios intentos no se encuentra un código único,
        // generamos uno con un timestamp para garantizar unicidad
        const timestamp = Date.now().toString(36).toUpperCase();
        return `${timestamp.substr(-4)}${Array(4).fill()
            .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
            .join('')}`;
    }

    function generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return Array(length).fill()
            .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
            .join('');
    }
};
