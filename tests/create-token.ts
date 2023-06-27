import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
    const client = new algosdk.Algodv2(
        process.env.ALGOD_TOKEN!,
        process.env.ALGOD_HOST!,
        process.env.ALGOD_PORT!
    );
    const sp = await client.getTransactionParams().do();
    const sender = algosdk.mnemonicToSecretKey(process.env.SENDER_MN!);
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addTransaction({
        txn: algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
            from: sender.addr,
            suggestedParams: sp,
            total: 1_000_000_000,
            decimals: 0,
            defaultFrozen: false,
            unitName: "A",
            assetName: "A",
        }),
        signer: algosdk.makeBasicAccountTransactionSigner(sender)
    });

    const result = await atc.execute(client, 4)
    const res = await client.pendingTransactionInformation(result.txIDs[0]).do()
    console.log("Created asset:", res["asset-index"])
    
})().catch((e) => {
    console.log(e);
});
