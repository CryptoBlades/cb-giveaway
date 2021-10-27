const data = require('./config.json')

module.exports = data.environments[data.environment]
