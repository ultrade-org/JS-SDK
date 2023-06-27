import algosdk from 'algosdk';
import * as dotenv from 'dotenv';
import { AmmClient } from '../src';

dotenv.config();

describe('ultrade amm sdk', async () => {
    const appId = parseInt(process.env.MASTER_ID!);
    const sender = algosdk.mnemonicToSecretKey(process.env.SENDER_MN!);
    const algodClient = new algosdk.Algodv2(
        process.env.ALGOD_TOKEN!,
        process.env.ALGOD_HOST!,
        process.env.ALGOD_PORT!
    );
    const client = new AmmClient(appId, algodClient);

    it('check status', async () => {
        const status = await client.getStatus();
        console.log(status);
    });

    it('create pair ASA1-ASA2', async () => {
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.createPair(sender.addr, 6, 7, signer);
    });

    it('create pair ALGO-ASA1', async () => {
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.createPair(sender.addr, 0, 6, signer);
    });

    it('create pair ALGO-ASA2', async () => {
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.createPair(sender.addr, 0, 7, signer);
    });

    it('create pair USDC-USDT', async () => {
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.createPair(sender.addr, 8, 9, signer);
    });

    it('add liquidity ASA1-ASA2', async () => {
        const poolToken = await client.getPoolToken(6, 7);
        if (!(await client.isOptedInAsset(poolToken, sender.addr))) {
            const params = await client.getTransactionParams();
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addTransaction({
                txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    amount: 0,
                    from: sender.addr,
                    suggestedParams: params,
                    to: sender.addr,
                    assetIndex: poolToken
                }),
                signer: algosdk.makeBasicAccountTransactionSigner(sender)
            });
            await atc.execute(client.getAlgodClient(), 4);
        }
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.addLiquidity(sender.addr, 6, 10000, 7, 10000, 100, signer);
    });

    it('add liquidity ALGO-ASA1', async () => {
        const poolToken = await client.getPoolToken(0, 6);
        if (!(await client.isOptedInAsset(poolToken, sender.addr))) {
            const params = await client.getTransactionParams();
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addTransaction({
                txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    amount: 0,
                    from: sender.addr,
                    suggestedParams: params,
                    to: sender.addr,
                    assetIndex: poolToken
                }),
                signer: algosdk.makeBasicAccountTransactionSigner(sender)
            });
            await atc.execute(client.getAlgodClient(), 4);
        }
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.addLiquidity(sender.addr, 0, 10000, 6, 10000, 100, signer);
    });

    it('add liquidity ALGO-ASA2', async () => {
        const poolToken = await client.getPoolToken(0, 7);
        if (!(await client.isOptedInAsset(poolToken, sender.addr))) {
            const params = await client.getTransactionParams();
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addTransaction({
                txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    amount: 0,
                    from: sender.addr,
                    suggestedParams: params,
                    to: sender.addr,
                    assetIndex: poolToken
                }),
                signer: algosdk.makeBasicAccountTransactionSigner(sender)
            });
            await atc.execute(client.getAlgodClient(), 4);
        }
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.addLiquidity(sender.addr, 0, 10000, 7, 10000, 100, signer);
    });

    it('add liquidity USDC-USDT', async () => {
        const poolToken = await client.getPoolToken(8, 9);
        if (!(await client.isOptedInAsset(poolToken, sender.addr))) {
            const params = await client.getTransactionParams();
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addTransaction({
                txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    amount: 0,
                    from: sender.addr,
                    suggestedParams: params,
                    to: sender.addr,
                    assetIndex: poolToken
                }),
                signer: algosdk.makeBasicAccountTransactionSigner(sender)
            });
            await atc.execute(client.getAlgodClient(), 4);
        }
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.addLiquidity(sender.addr, 8, 10000, 9, 10000, 100, signer);
    });

    it('remove liquidity ASA1-ASA2', async () => {
        const poolToken = await client.getPoolIdByAssets(6, 7);
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.removeLiquidity(
            sender.addr,
            poolToken,
            2000,
            0,
            0,
            signer
        );
    });

    it('remove liquidity ALGO-ASA1', async () => {
        const poolToken = await client.getPoolIdByAssets(0, 6);
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.removeLiquidity(
            sender.addr,
            poolToken,
            2000,
            0,
            0,
            signer
        );
    });

    it('remove liquidity ALGO-ASA2', async () => {
        const poolToken = await client.getPoolIdByAssets(0, 7);
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.removeLiquidity(
            sender.addr,
            poolToken,
            2000,
            0,
            0,
            signer
        );
    });

    it('swap ASA1-ASA2', async () => {
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.swap(sender.addr, 6, 2000, 7, 5, signer);
    });

    it('swap ASA2-ASA1', async () => {
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.swap(sender.addr, 7, 2000, 6, 5, signer);
    });

    it('swap ALGO-ASA1', async () => {
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.swap(sender.addr, 0, 2000, 6, 5, signer);
    });

    it('swap ASA1-ALGO', async () => {
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.swap(sender.addr, 6, 2000, 0, 5, signer);
    });

    it('swap ALGO-ASA2', async () => {
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.swap(sender.addr, 0, 2000, 7, 5, signer);
    });

    it('swap ASA2-ALGO', async () => {
        const signer = algosdk.makeBasicAccountTransactionSigner(sender);
        await client.swap(sender.addr, 7, 2000, 0, 5, signer);
    });

    it('get liquidity token amount', async () => {
        const txnComp = await client.getMintAmt(6, 2000, 7, 2000);
        // console.log(txnComp);
    });

    it('get pool states', async () => {
        const poolStates = await client.getPoolStates();
        console.log(poolStates);
    })
});
