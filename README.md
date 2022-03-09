# CB Giveaway Script
## Build

- `npm run build`

## Run

- `giveaway [args]` - to run the script

## ARGS
- `--private-key` - wallet private key of the minter; `optional` if `--is-test` is `true`
- `--is-test` - `true` or `false`; default: `true`
- `--csv` - path to entries csv file
- `--network={chain}` - chains: BSC, HECO, OEC, POLYGON, AVAX
- `--new` - clears the progress of current entries. `optional`

## Entries format 
Must be in `.csv` format: `address,nftType,stars,element`

- `address` - address of the receiver
- `nftType` - `weapon` or `shield`
- `stars` -  `1-5` or `*` for random
- `element` - `0` = Fire, `1` = Earth, `2` = Lightning, `3` = Water, `100` = Random
