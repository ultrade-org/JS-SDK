import algosdk from 'algosdk';
import dotenv from 'dotenv';
import { MASTER_ABI } from '../src/artifacts/master';

dotenv.config();

(async () => {
    const client = new algosdk.Algodv2(
        process.env.ALGOD_TOKEN!,
        process.env.ALGOD_HOST!,
        process.env.ALGOD_PORT!
    );
    const appId = parseInt(process.env.MASTER_ID!);
    const sp = await client.getTransactionParams().do();
    const sender = algosdk.mnemonicToSecretKey(process.env.SENDER_MN!);
    const masterContract = new algosdk.ABIContract(MASTER_ABI);
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addTransaction({
        txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            from: sender.addr,
            suggestedParams: sp,
            to: algosdk.getApplicationAddress(appId),
            amount: 106_100
        }),
        signer: algosdk.makeBasicAccountTransactionSigner(sender)
    })
    atc.addMethodCall({
        sender: sender.addr,
        appID: appId,
        method: getMethodByName(masterContract, 'add_stable_coin'),
        methodArgs: [8],
        boxes: [{ appIndex: appId, name: algosdk.encodeUint64(8) }],
        suggestedParams: sp,
        signer: algosdk.makeBasicAccountTransactionSigner(sender)
    });

    const result = await atc.execute(client, 4);
    console.log(result);
})().catch((e) => {
    console.log(e);
});

function getMethodByName(
    contract: algosdk.ABIContract,
    name: string
): algosdk.ABIMethod {
    const m = contract.methods.find((mt: algosdk.ABIMethod) => {
        return mt.name == name;
    });
    if (m === undefined) throw Error('Method undefined: ' + name);
    return m;
}
