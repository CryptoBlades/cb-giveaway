const Web3 = require('web3')
const fs = require('fs-extra')
const random = require('random')
const { blue, green, red, cyan, yellow } = require('chalk')
const moment = require('moment')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const fetch = require('node-fetch')
const { join } = require('path')

const argv = yargs(hideBin(process.argv)).argv

const config = require('./config/index')

let entryPath = ''
let donePath = ''
let network = 'BSC'
let isTest = true

const ABI_URL = 'https://app.cryptoblades.io/abi/'
const ABIS = [
  'Weapons',
  'Shields'
]

if (argv['is-test']) isTest = (argv['is-test'] === 'true')

if (argv.csv) {
  entryPath = argv.csv
  donePath = join(process.cwd(), '/done.csv')
} else {
  console.log(blue(moment().format('LTS')), '|', red('No csv provided.'))
  process.exit(0)
}

if (argv.network) network = argv.network
if (argv.clean) {
  fs.removeSync(donePath)
}

const web3 = new Web3(config.chains[network].rpcUrls[0])

const Weapons = new web3.eth.Contract(require('./contracts/Weapons'), config.chains[network].VUE_APP_WEAPON_CONTRACT_ADDRESS)
const Shields = new web3.eth.Contract(require('./contracts/Shields'), config.chains[network].VUE_APP_SHIELD_CONTRACT_ADDRESS)

const maxAttempts = 5
let data = []
let done = []
let privateKey = ''
let index = 0
let attempts = 0
const probability = [...Array(1).fill(4), ...Array(5).fill(3), ...Array(15).fill(2), ...Array(35).fill(1), ...Array(44).fill(0)]

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

  const { address, nftType, stars, element } = data[index]

  const fStars = (stars === '*' ? probability[random.int(0, 99)] : Number(stars) - 1)
  const fElement = numberToElement(element)

  if (!fElement && nftType === 'weapon') {
    console.log(blue(moment().format('LTS')), '|', yellow(`Invalid element | ${fStars + 1}-star ${nftType} to ${address}.`))
    attempts = 0
    index += 1
    return distribute()
  }

  if (done.filter(i => i.address === address && nftType === i.nftType && i.stars === stars).length > 0) {
    console.log(blue(moment().format('LTS')), '|', yellow(`Duplicate detected | ${fStars + 1}-star ${fElement} ${nftType} to ${address}.`))
    attempts = 0
    index += 1
    return distribute()
  }

  const transaction = (nftType === 'weapon' ? Weapons.methods.mintGiveawayWeapon(address, fStars, element) : Shields.methods.mintGiveawayShield(address, fStars, 2))

  const options = {
    to: config.chains[network][(nftType === 'weapon' ? 'VUE_APP_WEAPON_CONTRACT_ADDRESS' : 'VUE_APP_SHIELD_CONTRACT_ADDRESS')],
    data: transaction.encodeABI(),
    gas: config.chains[network].GAS_LIMIT,
    gasPrice: web3.utils.toWei(config.chains[network].GAS_PRICE, 'gwei')
  }

  try {
    if (!isTest) {
      const signed = await web3.eth.accounts.signTransaction(options, privateKey)
      await web3.eth.sendSignedTransaction(signed.rawTransaction)
    }
    console.log(blue(moment().format('LTS')), '|', green(`Successfully sent ${fStars + 1}-star ${fElement} ${nftType} to ${address}.`))
    done.push(data[index])
    fs.appendFileSync(donePath, `${address},${nftType},${stars}\n`)
    attempts = 0
    index += 1
  } catch (e) {
    console.log(blue(moment().format('LTS')), '|', red(`Failed to send ${fStars + 1}-star ${fElement} ${nftType} to ${address}. Trying again.`))
    attempts += 1
  }
  distribute()
}

async function init () {
  await updateAbi()
  privateKey = argv['private-key']
  fs.ensureFileSync(donePath)

  const list = fs.readFileSync(entryPath).toString().split('\n')
  const dlist = fs.readFileSync(donePath).toString().split('\n')

  if (!list || !list.length) {
    console.log(blue(moment().format('LTS')), '|', red('File is empty.'))
    process.exit(0)
  }

  if (!privateKey && !isTest) {
    console.log(blue(moment().format('LTS')), '|', red('No private key provided.'))
    process.exit(0)
  }

  data = list.filter(i => i).map(i => {
    const line = i.split(',')
    return {
      address: line[0],
      nftType: line[1],
      stars: line[2].trim(),
      element: Number(line[3]) || 100
    }
  })

  if (dlist.length > 0) {
    done = dlist.filter(i => i).map(i => {
      const line = i.split(',')
      return {
        address: line[0],
        nftType: line[1],
        stars: line[2].trim()
      }
    })
  }
  distribute()
}

async function updateAbi () {
  console.log(blue(moment().format('LTS')), '|', cyan('Updating ABIs...'))
  fs.ensureDirSync('./contracts/')
  await Promise.all(
    ABIS.map(async (name) => {
      const contract = await fetch(`${ABI_URL}/${name}.json`).then((res) =>
        res.json()
      )
      fs.writeJsonSync(`./contracts/${name}.json`, contract.abi)
    })
  )
  console.log(blue(moment().format('LTS')), '|', green('ABIs updated.'))
}

function numberToElement (num) {
  switch (num) {
    case 0: return 'fire'
    case 1: return 'earth'
    case 2: return 'lightning'
    case 3: return 'water'
    case 100: return 'random'
    default: return false
  }
}

init()
