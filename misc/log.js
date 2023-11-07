const settings = require('../settings.json')
const fetch = require('node-fetch')

/**
 * Log an action to Discord
 * @param {string} action 
 * @param {string} message 
 */
module.exports = (action, message) => {
    if (!settings.logging.status) return
    if (!settings.logging.actions.user[action] && !settings.logging.actions.admin[action]) return

    fetch(settings.logging.webhook, {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            embeds: [
                {
                    color: hexToDecimal('#191c24'),
                    title: `Event: \`${action}\``,
                    description: message,
                    author: {
                        name: 'Logging'
                    },
                    thumbnail: {
                        url: 'https://cdn.discordapp.com/attachments/1024881699307388988/1166476710758326353/logo.png?ex=6553db97&is=65416697&hm=abc406d9a8298933b916865bb37fcaa980c5b4cda3d8393216d2ce582e014f28&'
                    }
                }
            ]
        })
    })
    .catch(() => {})
}

function hexToDecimal(hex) {
    return parseInt(hex.replace("#", ""), 16)
}