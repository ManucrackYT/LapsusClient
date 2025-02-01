const indexjs = require("../index.js");
const ejs = require("ejs");
const express = require("express");
const settings = require("../settings.json");
const fetch = require('node-fetch');
const arciotext = require('../stuff/arciotext')

module.exports.load = async function(app, db) {
  app.all("/", async (req, res) => {
    if (req.session.pterodactyl) if (req.session.pterodactyl.id !== await db.get("users-" + req.session.userinfo.id)) return res.redirect("/login?prompt=none")
    let theme = indexjs.get(req);

    // Add referral data to the render data
    const renderData = await eval(indexjs.renderdataeval);
    
    // If we're on the referral page, fetch the user's referral
    if (req._parsedUrl.pathname === "/referral" && req.session.userinfo) {
        renderData.referral = await db.get(`referral-${req.session.userinfo.id}`);
    }

    if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname)) if (!req.session.userinfo || !req.session.pterodactyl) return res.redirect("/login");
    if (theme.settings.mustbeadmin.includes(req._parsedUrl.pathname)) {
      ejs.renderFile(
        `./themes/${theme.name}/${theme.settings.notfound}`, 
        renderData,
        null,
      async function (err, str) {
        delete req.session.newaccount;
        if (!req.session.userinfo || !req.session.pterodactyl) {
          if (err) {
            console.log(`[WEBSITE] An error has occured on path ${req._parsedUrl.pathname}:`);
            console.log(err);
            return res.send(err);
          };
          return res.send(str);
        };
  
        let cacheaccount = await fetch(
          settings.pterodactyl.domain + "/api/application/users/" + (await db.get("users-" + req.session.userinfo.id)) + "?include=servers",
          {
            method: "get",
            headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
          }
        );
        if (await cacheaccount.statusText == "Not Found") {
          if (err) {
            console.log(`[WEBSITE] An error has occured on path ${req._parsedUrl.pathname}:`);
            console.log(err);
            return res.send(err);
          };
          return res.send(str);
        };
        let cacheaccountinfo = JSON.parse(await cacheaccount.text());
      
        req.session.pterodactyl = cacheaccountinfo.attributes;
        if (cacheaccountinfo.attributes.root_admin !== true) {
          if (err) {
            console.log(`[WEBSITE] An error has occured on path ${req._parsedUrl.pathname}:`);
            console.log(err);
            return res.send(err);
          };
          return res.send(str);
        };
  
        ejs.renderFile(
          `./themes/${theme.name}/${theme.settings.index}`, 
          renderData,
          null,
        function (err, str) {
          if (err) {
            console.log(`[WEBSITE] An error has occured on path ${req._parsedUrl.pathname}:`);
            console.log(err);
            return res.send(err);
          };
          delete req.session.newaccount;
          res.send(str);
        });
      });
      return;
    };
    ejs.renderFile(
      `./themes/${theme.name}/${theme.settings.index}`, 
      renderData,
      null,
    function (err, str) {
      if (err) {
        console.log(`[WEBSITE] An error has occured on path ${req._parsedUrl.pathname}:`);
        console.log(err);
        return res.send(err);
      };
      delete req.session.newaccount;
      res.send(str);
    });
  });

  app.use('/assets', express.static('./assets'));
};