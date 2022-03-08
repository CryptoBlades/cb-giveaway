const Web3 = require('web3')
const fs = require('fs-extra')
const path = require('path')
const { blue, green, red, cyan, yellow } = require('chalk')
const moment = require('moment')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

require('dotenv').config()

const config = require('./config/index')

let filename = 'entries'
let network = 'BSC'

if (argv.file) {
  filename = argv.file
}

if (argv.network) {
  network = argv.network
}

if (argv.test) {
  filename = 'test'
}

const file = path.join(__dirname, `/data/${filename}.csv`)
const doneFile = path.join(__dirname, `/data/${filename}-done.csv`)
const web3 = new Web3(config.chains[network].rpcUrls[0])

const Weapons = new web3.eth.Contract(require('./contracts/Weapons'), config.chains[network].VUE_APP_WEAPON_CONTRACT_ADDRESS)
const Shields = new web3.eth.Contract(require('./contracts/Shields'), config.chains[network].VUE_APP_SHIELD_CONTRACT_ADDRESS)

const maxAttempts = 5
let data = []
let done = []
let privateKey = ''
let index = 0
let attempts = 0

async function distribute () {
  if (index >= data.length) {
    console.log(blue(moment().format('LTS')), '|', cyan('Finished.'))
    process.exit(0)
  }
  if (!data.length || !data[index]) {
    console.log(blue(moment().format('LTS')), '|', red('No data.'))
    process.exit(0)
  }
  if (attempts > maxAttempts) {
    console.log(blue(moment().format('LTS')), '|', red('Too many failed attempts.'))
    process.exit(0)
  }

  const { address, nftType, stars } = data[index]

  const fStars = (stars === '*' ? Math.floor(Math.random() * 5) : stars - 1)

  if (done.filter(i => i.address === address && i.stars === stars).length > 0) {
    console.log(blue(moment().format('LTS')), '|', yellow(`Duplicate detected | ${fStars + 1}-star ${nftType} to ${address}.`))
    attempts = 0
    index += 1
    return distribute()
  }

  const transaction = (nftType === 'weapon' ? Weapons.methods.mintGiveawayWeapon(address, fStars, 100) : Shields.methods.mintGiveawayShield(address, fStars, 2))

  const options = {
    to: config.chains[network][(nftType === 'weapon' ? 'VUE_APP_WEAPON_CONTRACT_ADDRESS' : 'VUE_APP_SHIELD_CONTRACT_ADDRESS')],
    data: transaction.encodeABI(),
    gas: '300000',
    gasPrice: web3.utils.toWei('2.35', 'gwei')
  }

  try {
    const signed = await web3.eth.accounts.signTransaction(options, privateKey)
    await web3.eth.sendSignedTransaction(signed.rawTransaction)
    console.log(blue(moment().format('LTS')), '|', green(`Successfully sent ${fStars + 1}-star ${nftType} to ${address}.`))
    done.push(data[index])
    fs.appendFileSync(doneFile, `${address},${stars}\n`)
    attempts = 0
    index += 1
  } catch (e) {
    console.log(blue(moment().format('LTS')), '|', red(`Failed to send ${fStars + 1}-star ${nftType} to ${address}. Trying again.`))
    attempts += 1
  }
  distribute()
}

function init () {
  privateKey = process.env.WALLET_PRIVATE_KEY
  fs.ensureFileSync(doneFile)

  const list = fs.readFileSync(file, 'ascii').split('\n')
  const dlist = fs.readFileSync(doneFile, 'ascii').split('\n')

  if (!list || !list.length) {
    console.log(blue(moment().format('LTS')), '|', red('File is empty.'))
    process.exit(0)
  }

  if (!privateKey) {
    console.log(blue(moment().format('LTS')), '|', red('No private key provided.'))
    process.exit(0)
  }

  data = list.filter(i => i).map(i => {
    const line = i.split(',')
    return {
      address: line[0],
      nftType: line[1],
      stars: parseInt(line[2])
    }
  })

  if (dlist.length > 0) {
    done = dlist.filter(i => i).map(i => {
      const line = i.split(',')
      return {
        address: line[0],
        nftType: line[1],
        stars: parseInt(line[2])
      }
    })
  }
  distribute()
}

init()
