const settings = require("../settings.json");
const fetch = require('node-fetch');

module.exports.load = async function(app, db) {
    app.get("/api/servers/start", async (req, res) => {
        if (!req.session.pterodactyl) return res.redirect("/login");
        const id = req.query.id;
        const user = req.query.user;
    
        if (!id || !user) {
            return;
        }
    
        if (user != req.session.userinfo.id) {
            return res.json({ "success": false, "message": "Unauthorized request" });
        }
    
        try {
            const response = await fetch(`${settings.pterodactyl.domain}/api/client/servers/${id}/power`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${settings.pterodactyl.account_key}`
                },
                body: JSON.stringify({ signal: "start" })
            });
    
            if (!response.ok) {
                console.error(`Failed to start server. Status: ${response.status}`);
                return res.json({ "success": false, "message": "Failed to start server" });
            }
    
            console.log("Server started successfully");
            return res.json({ "success": true, "message": "Operation success!" });
        } catch (error) {
            console.error("Error during server start request:", error);
            return res.json({ "success": false, "message": "Internal server error" });
        }
    });
        app.get("/api/servers/restart", async (req, res) => {
        if (!req.session.pterodactyl) return res.redirect("/login");
        const id = req.query.id;
        const user = req.query.user;
    
        if (!id || !user) {
            return;
        }
    
        if (user != req.session.userinfo.id) {
            return res.json({ "success": false, "message": "Unauthorized request" });
        }
    
        try {
            const response = await fetch(`${settings.pterodactyl.domain}/api/client/servers/${id}/power`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${settings.pterodactyl.account_key}`
                },
                body: JSON.stringify({ signal: "restart" })
            });
    
            if (!response.ok) {
                console.error(`Failed to start server. Status: ${response.status}`);
                return res.json({ "success": false, "message": "Failed to start server" });
            }
    
            console.log("Server started successfully");
            return res.json({ "success": true, "message": "Operation success!" });
        } catch (error) {
            console.error("Error during server start request:", error);
            return res.json({ "success": false, "message": "Internal server error" });
        }
    });
    app.get("/api/servers/stop", async (req, res) => {
        if (!req.session.pterodactyl) return res.redirect("/login");
        const id = req.query.id;
        const user = req.query.user;
    
        if (!id || !user) {
            return;
        }
    
        if (user != req.session.userinfo.id) {
            return res.json({ "success": false, "message": "Unauthorized request" });
        }
    
        try {
            const response = await fetch(`${settings.pterodactyl.domain}/api/client/servers/${id}/power`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${settings.pterodactyl.account_key}`
                },
                body: JSON.stringify({ signal: "stop" })
            });
    
            if (!response.ok) {
                console.error(`Failed to start server. Status: ${response.status}`);
                return res.json({ "success": false, "message": "Failed to start server" });
            }
    
            console.log("Server started successfully");
            return res.json({ "success": true, "message": "Operation success!" });
        } catch (error) {
            console.error("Error during server start request:", error);
            return res.json({ "success": false, "message": "Internal server error" });
        }
    });
}
