const Web3 = require('web3')
const fs = require('fs')
const path = require('path')
const { blue, green, red, cyan } = require('chalk')
const moment = require('moment')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

require('dotenv').config()

const config = require('./config/index')

const file = path.join(__dirname, '/entries.csv')
const testFile = path.join(__dirname, '/test.csv')
const web3 = new Web3(config.chains[process.env.CHAIN].rpcUrls[0])

const Weapon = new web3.eth.Contract(require('./contracts/Weapons'), config.chains[process.env.CHAIN].VUE_APP_WEAPON_CONTRACT_ADDRESS)

const maxAttempts = 5
let data = []
let privateKey = ''
let index = 0
let attempts = 0

async function distribute () {
  if (index > data.length) {
    console.log(blue(moment().format('LTS')), '|', cyan('Finished.'))
    process.exit(0)
  }
  if (!data.length || !data[index]) {
    console.log(blue(moment().format('LTS')), '|', red('No data.'))
    process.exit(0)
  }
  if (attempts > maxAttempts) {
    console.log(blue(moment().format('LTS')), '|', red('Too many failed transactions.'))
    process.exit(0)
  }

  const { address, stars } = data[index]

  const fStars = (stars === 3 ? Math.floor(Math.random() * 3) : stars - 1)

  const transaction = Weapon.methods.mintGiveawayWeapon(address, fStars, 100)

  const options = {
    to: config.chains[process.env.CHAIN].VUE_APP_WEAPON_CONTRACT_ADDRESS,
    data: transaction.encodeABI(),
    gas: '300000',
    gasPrice: web3.utils.toWei('2.35', 'gwei')
  }

  try {
    const signed = await web3.eth.accounts.signTransaction(options, privateKey)
    await web3.eth.sendSignedTransaction(signed.rawTransaction)
    console.log(blue(moment().format('LTS')), '|', green(`Successfully sent ${fStars + 1}-star weapon to ${address}.`))
    attempts = 0
    index += 1
  } catch (e) {
    console.log(blue(moment().format('LTS')), '|', red(`Failed to send ${fStars + 1}-star weapon to ${address}. Trying again.`))
    attempts += 1
  }
  distribute()
}

function init () {
  privateKey = process.env.WALLET_PRIVATE_KEY

  let list = fs.readFileSync(file, 'ascii').split('\n')

  if (argv.test) list = fs.readFileSync(testFile, 'ascii').split('\n')

  if (!list || !list.length) {
    console.log(blue(moment().format('LTS')), '|', red('File is empty.'))
    process.exit(0)
  }

  if (!privateKey) {
    console.log(blue(moment().format('LTS')), '|', red('No private key provided.'))
    process.exit(0)
  }

  data = list.map(i => {
    const line = i.split(',')
    return {
      address: line[0],
      stars: line[1]
    }
  })
  distribute()
}

init()
