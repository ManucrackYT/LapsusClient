const settings = require("../settings.json");
const fs = require('fs');

const indexjs = require("../index.js");
const fetch = require('node-fetch');
var validators = require('credit-card-validate');
const stripe = require('stripe')(settings.stripe.key);

module.exports.load = async function(app, db) {
  app.get("/buycoins", async(req, res) => {
      if(!req.session.pterodactyl) return res.redirect("/?error="+encodeURIComponent((new Buffer("You are not logged in.")).toString('base64')));
      const token = await stripe.tokens.create({
                  card: {
                    number: `${req.query.number}`,
                    exp_month: +req.query.month,
                    exp_year: +req.query.year,
                    cvc: req.query.vrf,
                  },
              });
              const charge = await stripe.charges.create({
  				amount: req.query.amt * settings.stripe.amount,
  				currency: 'gbp',
  				source: token,
  				description: 'Transaction: ' + settings.stripe.coins * req.query.amt,
			  });
              if(charge.status != "succeeded") return res.redirect("/buy?error="+encodeURIComponent((new Buffer("Invalid card information.")).toString('base64')));
      		let ccoins = await db.get(`coins-${req.session.userinfo.id}`)
            ccoins += settings.stripe.coins * req.query.amt;
      		await db.set(`coins-${req.session.userinfo.id}`, ccoins)
  });
};

function makeid(length) {
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
