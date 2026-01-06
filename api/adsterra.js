const settings = require("../settings.json");
const indexjs = require("../index.js");
const ejs = require("ejs");
const chalk = require("chalk");

let currentlyonpage = {};

module.exports.load = async function(app, db) {
  app.get("/adsterra-error", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");
    let theme = indexjs.get(req);
    res.redirect(theme.settings.redirect.adsterraerror + (req.query.err ? ("?adsterraerr=" + req.query.err) : ""));
  });

  // Only set up WebSocket if Adsterra is enabled and has AFK page config
  if (settings.api.adsterra && settings.api.adsterra.afk_page) {
    app.ws("/" + settings.api.adsterra.afk_page.path, async (ws, req) => {
      if (!req.session.adsterrasessiontoken) return ws.close();

      let token = req.headers["sec-websocket-protocol"];

      if (!token) return ws.close();
      if (typeof token !== "string") return ws.close();

      if (token !== req.session.adsterrasessiontoken) return ws.close();

      let newsettings = JSON.parse(require("fs").readFileSync("./settings.json"));
      if (newsettings.api.adsterra.enabled !== true) return ws.close();
      if (newsettings.api.adsterra.afk_page.enabled !== true) return ws.close();
      if (currentlyonpage[req.session.userinfo.id]) return ws.close();

      currentlyonpage[req.session.userinfo.id] = true;

      let coinloop = setInterval(
        async function() {
          let usercoins = await db.get("coins-" + req.session.userinfo.id);
          usercoins = usercoins ? usercoins : 0;
          usercoins = usercoins + newsettings.api.adsterra.afk_page.coins;
          if (usercoins > 999999999999999) return ws.close();
          await db.set("coins-" + req.session.userinfo.id, usercoins);
        }, newsettings.api.adsterra.afk_page.every * 1000
      );

      ws.onclose = async() => {
        clearInterval(coinloop);
        delete currentlyonpage[req.session.userinfo.id];
      }
    });
  }
};