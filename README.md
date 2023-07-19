# Ultrade JS SDK

## Warning
SDK is under development
## Structure of SDK

Three are three classes: `AmmClient`, `TransactionComposer`, `PendingTxnResponse`.

`AmmClient` contains main and util functions.

main: 
- constructor
- create a pool for asset a and b
- bootstrap 
- add liquidity (mint)
- remove liquidity (burn)
- swap

a main function returns an instance of `TransactionComposer`.

utils:
- get pairs
- get LP token
- get pool by assets
- get pool by LP token
- get balances of an address
- get balance of an address per asset
- check if an address opted in an asset

`TransactionComposer` sign transactions with secret key or algorand session wallet and send them to blockchain. it has `signAndSend` public function returns `PendingTxnResponse`

`PendingTxnResponse` contains transaction infomation.

## Example of Usage

Please checkout unit tests in `tests` folder.

## License
MIT
