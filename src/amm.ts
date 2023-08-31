import algosdk from 'algosdk';
import { MASTER_ABI } from './artifacts/master';
import { POOL_ABI } from './artifacts/pool';
import { STABLE_ABI } from './artifacts/stable';
import {
    AssetList,
    IAssetAmt,
    PoolList,
    PoolState,
    TokenPair,
    PoolTypes,
    StablePoolState
} from './types';
import { ALGO } from './constants';
import { sqrt, decodeStateArray, getMethodByName } from './utils';

export class PendingTxnResponse {
    poolError: string;
    txn: Record<string, any>;
    applicationIndex: number | undefined;
    assetIndex: number | undefined;
    closeRewards: number | undefined;
    closingAmount: number | undefined;
    confirmedRound: number | undefined;
    globalStateDelta: any;
    localStateDelta: any;
    receiverRewards: number | undefined;
    senderRewards: number | undefined;
    innerTxns: Array<any>;
    logs: any;

    constructor(response: Record<string, any>) {
        this.poolError = response['pool-error'];
        this.txn = response['txn'];

        this.applicationIndex = response['application-index'];
        this.assetIndex = response['asset-index'];
        this.closeRewards = response['closing-rewards'];
        this.closingAmount = response['closing-amount'];
        this.confirmedRound = response['confirmed-round'];
        this.globalStateDelta = response['global-state-delta'];
        this.localStateDelta = response['local-state-delta'];
        this.receiverRewards = response['receiver-rewards'];
        this.senderRewards = response['sender-rewards'];

        this.innerTxns = response['inner-txns'] ? response['inner-txns'] : [];
        this.logs = response['logs'] ? response['logs'] : [];
    }
}

export class AmmClient {
    private client: algosdk.Algodv2;
    private appId: number;
    private masterContract: algosdk.ABIContract;
    private poolContract: algosdk.ABIContract;
    private stableContract: algosdk.ABIContract;
    private assetsCache: AssetList;
    private poolsCache: PoolList;

    /**
     * construct AmmClient
     *
     * @param appId master app id
     * @param cluster one of node
     */
    constructor(appId: number, client: algosdk.Algodv2) {
        this.client = client;
        this.appId = appId;
        this.masterContract = new algosdk.ABIContract(MASTER_ABI);
        this.poolContract = new algosdk.ABIContract(POOL_ABI);
        this.stableContract = new algosdk.ABIContract(STABLE_ABI);
        this.assetsCache = {};
        this.poolsCache = {};
    }

    getAssetCache() {
        return this.assetsCache;
    }

    getPoolsCache() {
        return this.poolsCache;
    }

    /**
     * get status of current node.
     *
     * @returns
     */
    async getStatus() {
        const status = await this.client.status().do();
        return status;
    }

    /**
     * check if an asset is stable coin.
     *
     * @returns
     */
    async isStableAsset(asset: number) {
        try {
            const boxName = algosdk.encodeUint64(asset);
            const box = await this.client
                .getApplicationBoxByName(this.appId, boxName)
                .do();
            const flag = algosdk.decodeUint64(box.value, 'safe');
            return flag != 0;
        } catch (e) {
            return false;
        }
    }

    /**
     * Returns the common needed parameters for a new transaction.
     *
     * @returns
     */
    async getTransactionParams() {
        const params = await this.client.getTransactionParams().do();
        return params;
    }

    /**
     * returns Algodv2 instance.
     *
     * @returns
     */
    getAlgodClient() {
        return this.client;
    }

    /**
     * create a pool for asset A and B.
     *
     * @param sender the sender of transaction
     * @param assetA
     * @param assetB
     * @returns
     */
    async createPair(
        sender: string,
        assetA: number,
        assetB: number,
        signer: algosdk.TransactionSigner
    ) {
        if (assetA > assetB) [assetA, assetB] = [assetB, assetA];

        const isPoolExist = await this.checkIsPoolExist(assetA, assetB);
        if (isPoolExist) {
            throw new Error('pool already created');
        }

        try {
            const f1 = await this.isStableAsset(assetA);
            const f2 = await this.isStableAsset(assetB);
            let tmpPoolId;
            if (f1 && f2) {
                tmpPoolId = await this.getTmpStablePoolId();
            } else {
                tmpPoolId = await this.getTmpPoolId();
            }
            const atc = new algosdk.AtomicTransactionComposer();
            const sp = await this.client.getTransactionParams().do();
            const boxName = new Uint8Array([
                ...algosdk.encodeUint64(assetA),
                ...algosdk.encodeUint64(assetB)
            ]);
            const appInfo = await this.client
                .getApplicationByID(this.appId)
                .do();
            const appCreator = appInfo.params.creator;
            atc.addMethodCall({
                appID: this.appId,
                method: getMethodByName(this.masterContract, 'create_pool'),
                methodArgs: [
                    {
                        txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject(
                            {
                                from: sender,
                                suggestedParams: sp,
                                to: algosdk.getApplicationAddress(this.appId),
                                amount: 3_324_100
                            }
                        ),
                        signer
                    },
                    assetA,
                    assetB
                ],
                appForeignApps: [tmpPoolId],
                appForeignAssets: [assetA, assetB],
                appAccounts: [appCreator],
                boxes: [
                    { appIndex: this.appId, name: boxName },
                    {
                        appIndex: this.appId,
                        name: algosdk.encodeUint64(assetA)
                    },
                    { appIndex: this.appId, name: algosdk.encodeUint64(assetB) }
                ],
                sender: sender,
                suggestedParams: {
                    ...sp,
                    flatFee: true,
                    fee: 12_000
                },
                signer
            });
            const res = await atc.execute(this.client, 4);
            return res;
        } catch (e: any) {
            throw new Error('create pair failed: ' + e.message);
        }
    }

    /**
     * Add liquidity to A-B pool
     *
     * @param sender the sender of transaction
     * @param aId id of asset A to send the A-B pool
     * @param aAmt amount of asset A
     * @param bId id of asset B
     * @param bAmt amount of asset B to send the A-B pool
     * @param mintAmt
     * @returns
     */
    async addLiquidity(
        sender: string,
        aId: number,
        aAmt: number | bigint,
        bId: number,
        bAmt: number | bigint,
        mintAmt: number | bigint,
        signer: algosdk.TransactionSigner
    ) {
        if (aId > bId) {
            [aId, bId] = [bId, aId];
            [aAmt, bAmt] = [bAmt, aAmt];
        }

        if (aAmt <= 1000 || bAmt <= 1000) {
            throw new Error('too small amount');
        }

        const poolId = await this.getPoolIdByAssets(aId, bId);

        const state = await this.getPoolState(poolId);

        if (state['a'] != aId || state['b'] != bId) {
            throw new Error('incorrect pair');
        }

        const params = await this.client.getTransactionParams().do();

        const poolAddress = algosdk.getApplicationAddress(poolId);
        const poolToken = state['p'];
        const atc = new algosdk.AtomicTransactionComposer();

        if (!(await this.isOptedInAsset(poolToken, sender))) {
            atc.addTransaction({
                txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    from: sender,
                    suggestedParams: params,
                    to: sender,
                    amount: 0,
                    assetIndex: poolToken
                }),
                signer
            });
        }

        const sp = await this.client.getTransactionParams().do();
        const firstMint = state['ra'] == 0 && state['rb'] == 0;
        const sf1 = await this.isStableAsset(aId);
        const sf2 = await this.isStableAsset(bId);
        if (firstMint) {
            if (aId == 0) {
                atc.addMethodCall({
                    sender,
                    appID: poolId,
                    method: getMethodByName(this.poolContract, 'fund'),
                    methodArgs: [
                        {
                            txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject(
                                {
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt
                                }
                            ),
                            signer
                        },
                        {
                            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                                {
                                    amount: bAmt,
                                    from: sender,
                                    suggestedParams: params,
                                    to: poolAddress,
                                    assetIndex: bId
                                }
                            ),
                            signer
                        }
                    ],
                    appForeignAssets: [bId, poolToken],
                    suggestedParams: {
                        ...sp,
                        flatFee: true,
                        fee: 2000
                    },
                    signer
                });
                const res = await atc.execute(this.client, 4);
                return res;
            } else {
                let method;
                if (sf1 && sf2) {
                    method = getMethodByName(this.stableContract, 'fund');
                } else {
                    method = getMethodByName(this.poolContract, 'fund');
                }
                atc.addMethodCall({
                    sender,
                    appID: poolId,
                    method,
                    methodArgs: [
                        {
                            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                                {
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt,
                                    assetIndex: aId
                                }
                            ),
                            signer
                        },
                        {
                            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                                {
                                    amount: bAmt,
                                    from: sender,
                                    suggestedParams: params,
                                    to: poolAddress,
                                    assetIndex: bId
                                }
                            ),
                            signer
                        }
                    ],
                    appForeignAssets: [aId, bId, poolToken],
                    suggestedParams: {
                        ...sp,
                        flatFee: true,
                        fee: 2000
                    },
                    signer
                });
                const res = await atc.execute(this.client, 4);
                return res;
            }
        } else {
            if (aId == 0) {
                atc.addMethodCall({
                    sender,
                    appID: poolId,
                    method: getMethodByName(this.poolContract, 'mint'),
                    methodArgs: [
                        {
                            txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject(
                                {
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt
                                }
                            ),
                            signer
                        },
                        {
                            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                                {
                                    amount: bAmt,
                                    from: sender,
                                    suggestedParams: params,
                                    to: poolAddress,
                                    assetIndex: bId
                                }
                            ),
                            signer
                        },
                        mintAmt
                    ],
                    appForeignAssets: [bId, poolToken],
                    suggestedParams: {
                        ...sp,
                        flatFee: true,
                        fee: 4000
                    },
                    signer
                });
                const res = await atc.execute(this.client, 4);
                return res;
            } else {
                let method;
                let methodArgs: algosdk.ABIArgument[];
                if (sf1 && sf2) {
                    method = getMethodByName(this.stableContract, 'mint');
                    methodArgs = [aAmt, bAmt, mintAmt];
                    if (aAmt == 0) {
                        methodArgs.push({
                            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                                {
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: bAmt,
                                    assetIndex: bId
                                }
                            ),
                            signer
                        });
                    } else if (bAmt == 0) {
                        methodArgs.push({
                            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                                {
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt,
                                    assetIndex: aId
                                }
                            ),
                            signer
                        });
                    } else {
                        methodArgs.push({
                            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                                {
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt,
                                    assetIndex: aId
                                }
                            ),
                            signer
                        });
                        methodArgs.push({
                            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                                {
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: bAmt,
                                    assetIndex: bId
                                }
                            ),
                            signer
                        });
                    }
                } else {
                    method = getMethodByName(this.poolContract, 'mint');
                    methodArgs = [
                        {
                            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                                {
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt,
                                    assetIndex: aId
                                }
                            ),
                            signer
                        },
                        {
                            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                                {
                                    amount: bAmt,
                                    from: sender,
                                    suggestedParams: params,
                                    to: poolAddress,
                                    assetIndex: bId
                                }
                            ),
                            signer
                        },
                        mintAmt
                    ];
                }
                atc.addMethodCall({
                    sender,
                    appID: poolId,
                    method,
                    methodArgs,
                    appForeignAssets: [aId, bId, poolToken],
                    suggestedParams: {
                        ...sp,
                        flatFee: true,
                        fee: 4000
                    },
                    signer
                });
                const res = await atc.execute(this.client, 4);
                return res;
            }
        }
    }

    /**
     * remove liquidity from the pool
     *
     * @param sender the sender of transaction
     * @param poolId
     * @param poolTokenAmt
     * @param aMinAmt
     * @param bMinAmt
     * @returns
     */
    async removeLiquidity(
        sender: string,
        poolId: number,
        poolTokenAmt: number | bigint,
        aMinAmt: number | bigint,
        bMinAmt: number | bigint,
        signer: algosdk.TransactionSigner
    ) {
        const poolState = await this.getPoolState(poolId);
        const poolTokenId = poolState['p'];

        const poolTokenBalance = await this.getBalance(poolTokenId, sender);
        if (poolTokenBalance < poolTokenAmt)
            throw new Error('insufficient pool token balance');

        const sp = await this.client.getTransactionParams().do();

        const foreignAssets =
            poolState['a'] == 0
                ? [poolTokenId, poolState['b']]
                : [poolTokenId, poolState['a'], poolState['b']];
        const sf1 = await this.isStableAsset(poolState['a']);
        const sf2 = await this.isStableAsset(poolState['b']);
        let method;
        if (sf1 && sf2) {
            method = getMethodByName(this.poolContract, 'burn');
        } else {
            method = getMethodByName(this.stableContract, 'burn');
        }
        const atc = new algosdk.AtomicTransactionComposer();
        atc.addMethodCall({
            sender,
            appID: poolId,
            method,
            methodArgs: [
                {
                    txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                        {
                            amount: poolTokenAmt,
                            from: sender,
                            suggestedParams: sp,
                            to: algosdk.getApplicationAddress(poolId),
                            assetIndex: poolTokenId
                        }
                    ),
                    signer
                },
                aMinAmt,
                bMinAmt
            ],
            appForeignAssets: foreignAssets,
            suggestedParams: {
                ...sp,
                flatFee: true,
                fee: 4000
            },
            signer
        });
        const res = await atc.execute(this.client, 4);
        return res;
    }

    /**
     * swap tokens
     *
     * @param sender the sender of transaction
     * @param inId asset id of input
     * @param inAmt input amount
     * @param outId asset id of output
     * @returns
     */
    async swap(
        sender: string,
        inId: number,
        inAmt: number | bigint,
        outId: number,
        slippage: number,
        signer: algosdk.TransactionSigner
    ) {
        let [assetIn, assetOut] = [inId, outId];
        if (assetIn > assetOut) [assetIn, assetOut] = [assetOut, assetIn];

        const poolId = await this.getPoolIdByAssets(assetIn, assetOut);
        const poolAddress = algosdk.getApplicationAddress(poolId);
        let poolState = await this.getPoolState(poolId);
        const poolToken = poolState['p'];

        const outAmt = this.getSwapOutputByState(inId, outId, poolState, inAmt);
        const minSwapAmt =
            (BigInt(outAmt) * (BigInt(100000) - BigInt(slippage * 1000))) /
            BigInt(100000);

        const params = await this.client.getTransactionParams().do();
        const atc = new algosdk.AtomicTransactionComposer();
        if (!(await this.isOptedInAsset(outId, sender))) {
            atc.addTransaction({
                txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    from: sender,
                    suggestedParams: params,
                    to: sender,
                    amount: 0,
                    assetIndex: outId
                }),
                signer
            });
        }
        if (inId == 0) {
            let foreignAssets = [outId, poolToken];
            atc.addMethodCall({
                sender,
                appID: poolId,
                method: getMethodByName(this.poolContract, 'swap'),
                methodArgs: [
                    {
                        txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject(
                            {
                                from: sender,
                                suggestedParams: params,
                                to: poolAddress,
                                amount: inAmt
                            }
                        ),
                        signer
                    },
                    minSwapAmt
                ],
                appForeignAssets: foreignAssets,
                suggestedParams: {
                    ...params,
                    flatFee: true,
                    fee: 2000
                },
                signer
            });
            const res = await atc.execute(this.client, 4);
            return res;
        } else {
            let foreignAssets;
            if (inId < outId) {
                foreignAssets = [inId, outId, poolToken];
            } else {
                foreignAssets = [outId, inId, poolToken];
            }
            atc.addMethodCall({
                sender,
                appID: poolId,
                method: getMethodByName(this.poolContract, 'swap'),
                methodArgs: [
                    {
                        txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
                            {
                                from: sender,
                                suggestedParams: params,
                                to: poolAddress,
                                amount: inAmt,
                                assetIndex: inId
                            }
                        ),
                        signer
                    },
                    minSwapAmt
                ],
                appForeignAssets: foreignAssets,
                suggestedParams: {
                    ...params,
                    flatFee: true,
                    fee: 2000
                },
                signer
            });
            const res = await atc.execute(this.client, 4);
            return res;
        }
    }

    /**
     * get LP token by asset A and B
     *
     * @param assetA
     * @param assetB
     * @returns
     */
    async getPoolToken(assetA: number, assetB: number): Promise<number> {
        const poolId = await this.getPoolIdByAssets(assetA, assetB);
        const state = await this.getPoolState(poolId);

        if (state['a'] != assetA || state['b'] != assetB) {
            throw new Error('incorrect pair');
        }
        return state['p'];
    }

    /**
     * get pool app id by asset A and B
     *
     * @param assetA
     * @param assetB
     * @returns
     */
    async getPoolIdByAssets(assetA: number, assetB: number): Promise<number> {
        if (assetA > assetB) [assetA, assetB] = [assetB, assetA];
        const cachedId = String(assetA) + String(assetB);
        if (this.poolsCache[cachedId]) return this.poolsCache[cachedId].poolId;
        else {
            const boxName = new Uint8Array([
                ...algosdk.encodeUint64(assetA),
                ...algosdk.encodeUint64(assetB)
            ]);
            const box = await this.client
                .getApplicationBoxByName(this.appId, boxName)
                .do();
            const poolId = algosdk.decodeUint64(box.value, 'safe');
            return poolId;
        }
    }

    /**
     * get pool app id by LP token
     * @param tokenId
     * @returns
     */
    async getPoolByToken(tokenId: number): Promise<TokenPair> {
        const pair = Object.values(this.poolsCache).find(
            (pair) => pair.poolState['p'] == tokenId
        );
        if (pair) return pair;
        else {
            const pairs = await this.getPairs();
            const idx = pairs.findIndex(
                (pair) => pair.poolState['p'] == tokenId
            );

            if (idx == -1) throw new Error('non-exist pool');
            const correctPair = pairs[idx];
            return correctPair;
        }
    }
    /**
     * Get pool by asset A id and asset B id
     * @param assetA
     * @param assetB
     * @returns
     */
    async getPoolByAssets(assetA: number, assetB: number): Promise<TokenPair> {
        if (assetA > assetB) [assetA, assetB] = [assetB, assetA];
        const cachedId = String(assetA) + String(assetB);
        if (this.poolsCache[cachedId]) {
            const poolState = await this.getPoolState(
                this.poolsCache[cachedId].poolId
            );
            return { ...this.poolsCache[cachedId], poolState };
        } else {
            const boxName = new Uint8Array([
                ...algosdk.encodeUint64(assetA),
                ...algosdk.encodeUint64(assetB)
            ]);
            const box = await this.client
                .getApplicationBoxByName(this.appId, boxName)
                .do();
            const poolId = algosdk.decodeUint64(box.value, 'safe');
            const poolState = await this.getPoolState(poolId);
            const poolToken = poolState['p'];
            let aa;
            if (assetA == 0) {
                aa = {
                    params: {
                        name: ALGO.name,
                        decimals: ALGO.decimals,
                        'unit-name': ALGO.unitName
                    }
                };
            } else {
                aa = await this.getAsset(assetA);
            }
            const bb = await this.getAsset(assetB);
            const pair: TokenPair = {
                aId: assetA,
                aName: aa.params['name'],
                aDecimals: aa.params['decimals'],
                aUnitName: aa.params['unit-name'],
                bId: assetB,
                bName: bb.params['name'],
                bDecimals: bb.params['decimals'],
                bUnitName: bb.params['unit-name'],
                poolId,
                poolToken,
                poolState,
                type: poolState['pt'] || 'CONSTANT_PRODUCT',
                fee: poolState['f'] || 20
            };
            this.poolsCache[cachedId] = pair;
            return pair;
        }
    }

    /**
     * get all pools
     *
     * @returns
     */
    async getPairs(): Promise<TokenPair[]> {
        const appAddress = algosdk.getApplicationAddress(this.appId);
        const appInfo = await this.client.accountInformation(appAddress).do();
        const createdApps = appInfo['created-apps'];
        let pools: TokenPair[] = [];
        for (const app of createdApps) {
            const poolId = app['id'];
            const stateArray = app['params']['global-state'];
            const poolState = decodeStateArray(stateArray) as
                | PoolState
                | StablePoolState;
            const aId = poolState['a'];
            const bId = poolState['b'];
            const poolToken = poolState['p'];
            const type: PoolTypes = poolState['pt'] || 'CONSTANT_PRODUCT';
            const fee = poolState['f'] || 20;
            const cachedId = String(aId) + String(bId);
            const cachedPool = this.poolsCache[cachedId];
            if (cachedPool) {
                pools.push({ ...cachedPool, poolToken, poolId, poolState });
            } else {
                let assetA: any;
                if (aId == 0) {
                    assetA = {
                        params: {
                            decimals: ALGO.decimals,
                            name: ALGO.name,
                            'unit-name': ALGO.unitName
                        }
                    };
                } else {
                    assetA = await this.getAsset(aId);
                }
                const assetB = await this.getAsset(bId);
                const pool: TokenPair = {
                    aId,
                    aDecimals: assetA.params['decimals'],
                    aName: assetA.params['name'],
                    aUnitName: assetA.params['unit-name'],
                    bId,
                    bDecimals: assetB.params['decimals'],
                    bName: assetB.params['name'],
                    bUnitName: assetB.params['unit-name'],
                    poolToken,
                    poolId,
                    poolState,
                    fee,
                    type: type
                };
                pools.push(pool);
                this.poolsCache[cachedId] = pool;
            }
        }
        return pools;
    }

    /**
     * get balances of an address
     *
     * @param address
     * @returns
     */
    async getBalances(address: string) {
        const accountInfo = await this.client.accountInformation(address).do();
        const balances: any = {
            '0': accountInfo['amount']
        };
        const assets = accountInfo['assets'];
        for (let i = 0; i < assets.length; i++) {
            const assetId = assets[i]['asset-id'];
            const assetAmt = assets[i]['amount'];
            balances[assetId] = assetAmt;
        }
        return balances;
    }

    /**
     * get balance of an address per asset
     *
     * @param assetId
     * @param address
     * @returns
     */
    async getBalance(
        assetId: number,
        address: string
    ): Promise<number | bigint> {
        const balances = await this.getBalances(address);
        return balances[assetId.toString()];
    }

    /**
     * check if an address opted in an asset
     *
     * @param assetId
     * @param addr
     * @returns
     */
    async isOptedInAsset(assetId: number, addr: string) {
        const balances = await this.getBalances(addr);
        return Object.keys(balances).includes(assetId.toString());
    }

    /**
     * get assets of addr
     *
     * @param addr
     * @returns
     */
    async getAssetList(addr: string) {
        const accountInfo = await this.client.accountInformation(addr).do();
        const as = accountInfo['assets'];
        const assetList = [];
        for (let i = 0; i < as.length; i++) {
            const a = as[i];
            try {
                const b = await this.client.getAssetByID(a['asset-id']).do();
                assetList.push({
                    id: b['index'],
                    name: b['params']['unit-name']
                });
            } catch (e) {
                console.log(e);
            }
        }
        return assetList;
    }

    /**
     * get output amount when a user swap A to B
     *
     * @param assetIn id of input asset
     * @param assetOut id of output asset
     * @param state pool state
     * @param amtIn input amount
     * @returns
     */
    getSwapOutputByState(
        assetIn: number,
        assetOut: number,
        state: PoolState,
        amtIn: number | bigint
    ): bigint {
        const aSup = state['ra'];
        const bSup = state['rb'];
        let [inSup, outSup] = [aSup, bSup];
        if (assetIn > assetOut) [inSup, outSup] = [bSup, aSup];
        const amtOut =
            (BigInt(amtIn) * BigInt(1000 - 3) * BigInt(outSup)) /
            (BigInt(inSup) * BigInt(1000) + BigInt(amtIn) * BigInt(1000 - 3));
        return amtOut;
    }

    /**
     * get output amount after swap
     *
     * @param txId transaction id
     * @returns
     */
    async getAmountAfterSwap(txId: string) {
        const txnInfo = await this.client
            .pendingTransactionInformation(txId)
            .do();
        const res = new PendingTxnResponse(txnInfo);
        if (res.logs.length) {
            return algosdk.decodeUint64(res.logs[0], 'safe');
        } else {
            throw new Error('no swap transaction');
        }
    }

    /**
     * Get liquidity token amounts
     *
     * @param assetA id of asset A to send the A-B pool
     * @param assetAAmt amount of asset A
     * @param assetB id of asset B
     * @param assetBAmt amount of asset B to send the A-B pool
     * @returns int
     */
    async getMintAmt(
        assetA: number,
        assetAAmt: number | bigint,
        assetB: number,
        assetBAmt: number | bigint
    ): Promise<bigint> {
        if (assetA > assetB) {
            [assetA, assetB] = [assetB, assetA];
            [assetAAmt, assetBAmt] = [assetBAmt, assetAAmt];
        }
        const poolId = await this.getPoolIdByAssets(assetA, assetB);
        const state = await this.getPoolState(poolId);

        if (state['a'] != assetA || state['b'] != assetB) {
            throw new Error('incorrect pair');
        }
        const reserveA = BigInt(state['ra']);
        const reserveB = BigInt(state['rb']);
        const issued = BigInt(state['ma']);
        if (reserveA == BigInt(0) && reserveB == BigInt(0)) {
            // on_fund
            const scale = BigInt(1000);
            return sqrt(BigInt(assetAAmt) * BigInt(assetBAmt)) - scale;
        } else {
            // on_mint
            if (BigInt(assetAAmt) * reserveB < BigInt(assetBAmt) * reserveA) {
                return (BigInt(assetAAmt) * issued) / reserveA;
            } else {
                return (BigInt(assetBAmt) * issued) / reserveB;
            }
        }
    }

    /**
     * Get liquidity token amounts by pool state
     *
     * @param state pool state
     * @param assetAAmt amount of asset A
     * @param assetBAmt amount of asset B to send the A-B pool
     * @returns int
     */
    getMintAmtByState(
        state: PoolState,
        assetAAmt: number | bigint,
        assetBAmt: number | bigint
    ) {
        const reserveA = BigInt(state['ra']);
        const reserveB = BigInt(state['rb']);
        const issued = BigInt(state['ma']);
        if (reserveA == BigInt(0) && reserveB == BigInt(0)) {
            // on_fund
            const scale = BigInt(1000);
            return sqrt(BigInt(assetAAmt) * BigInt(assetBAmt)) - scale;
        } else {
            // on_mint
            if (BigInt(assetAAmt) * reserveB < BigInt(assetBAmt) * reserveA) {
                return (BigInt(assetAAmt) * issued) / reserveA;
            } else {
                return (BigInt(assetBAmt) * issued) / reserveB;
            }
        }
    }

    /**
     * Make opt-in for asset/pool
     *
     * @param sender the sender of transaction
     * @param assetId id of asset/pool
     * @param signer transaction signer
     * @returns
     */

    async prepareOptInTxn(
        sender: string,
        assetId: number,
        signer: algosdk.TransactionSigner
    ) {
        const params = await this.client.getTransactionParams().do();
        const atc = new algosdk.AtomicTransactionComposer();
        atc.addTransaction({
            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                amount: 0,
                from: sender,
                suggestedParams: params,
                to: sender,
                assetIndex: assetId
            }),
            signer
        });
        const res = await atc.execute(this.client, 4);
        return res;
    }

    /**
     * Get assets amounts after pool token burn
     *
     * @param assetA id of asset A
     * @param assetB id of asset B
     * @param burnAmt burn amount
     * @returns
     */
    async getAssetAmtAfterBurnLP(
        assetA: number,
        assetB: number,
        burnAmt: number
    ): Promise<IAssetAmt> {
        const poolId = await this.getPoolIdByAssets(assetA, assetB);
        const state = await this.getPoolState(poolId);

        if (state['a'] != assetA || state['b'] != assetB) {
            throw new Error('incorrect pair');
        }
        const issued = BigInt(state['ma']);
        const reserveA = BigInt(state['ra']);
        const reserveB = BigInt(state['rb']);
        const aBurnedAmt = (BigInt(reserveA) * BigInt(burnAmt)) / issued;
        const bBurnedAmt = (BigInt(reserveB) * BigInt(burnAmt)) / issued;
        return {
            assetA: aBurnedAmt,
            assetB: bBurnedAmt
        };
    }

    /**
     * Get assets amounts after pool token burn by state
     *
     * @param state pool state
     * @param burnAmt burn amount
     * @returns
     */
    getAssetAmtAfterBurnLPByState(state: PoolState, burnAmt: number) {
        const issued = BigInt(state['ma']);
        const reserveA = BigInt(state['ra']);
        const reserveB = BigInt(state['rb']);
        const aBurnedAmt = (BigInt(reserveA) * BigInt(burnAmt)) / issued;
        const bBurnedAmt = (BigInt(reserveB) * BigInt(burnAmt)) / issued;
        return {
            assetA: aBurnedAmt,
            assetB: bBurnedAmt
        };
    }

    /**
     * get input amount from output when a user swap A to B
     *
     * @param assetIn id of input asset
     * @param assetOut id of output asset
     * @param amtOut output amount
     * @returns
     */
    async getSwapInput(
        assetIn: number,
        assetOut: number,
        amtOut: number | bigint
    ): Promise<bigint> {
        let [assetA, assetB] = [assetIn, assetOut];
        if (assetIn > assetOut) [assetA, assetB] = [assetOut, assetIn];
        const poolId = await this.getPoolIdByAssets(assetA, assetB);
        const state = await this.getPoolState(poolId);
        if (state['a'] != assetA || state['b'] != assetB) {
            throw new Error('incorrect pair');
        }
        const aSup = state['ra'];
        const bSup = state['rb'];
        let [inSup, outSup] = [aSup, bSup];
        if (assetIn > assetOut) [inSup, outSup] = [bSup, aSup];

        const amtIn =
            (BigInt(amtOut) * BigInt(inSup) * BigInt(1000)) /
                (BigInt(1000 - 3) * (BigInt(outSup) - BigInt(amtOut))) +
            BigInt(1);
        return amtIn;
    }

    /**
     * get input amount from output when a user swap A to B
     *
     * @param assetIn id of input asset
     * @param assetOut id of output asset
     * @param amtOut output amount
     * @param state pool state
     * @returns
     */
    getSwapInputByState(
        assetIn: number,
        assetOut: number,
        state: PoolState,
        amtOut: number | bigint
    ) {
        const aSup = state['ra'];
        const bSup = state['rb'];
        let [inSup, outSup] = [aSup, bSup];
        if (assetIn > assetOut) [inSup, outSup] = [bSup, aSup];

        const amtIn =
            (BigInt(amtOut) * BigInt(inSup) * BigInt(1000)) /
                (BigInt(1000 - 3) * (BigInt(outSup) - BigInt(amtOut))) +
            BigInt(1);
        return amtIn;
    }

    /**
     * get pool ratio
     * @param assetIn id of asset A
     * @param assetOut id of asset B
     * @returns
     */
    async getPoolRatio(
        assetIn: { index: number; decimals: number },
        assetOut: { index: number; decimals: number }
    ) {
        let [assetA, assetB] = [assetIn, assetOut];
        if (assetIn.index > assetOut.index)
            [assetA, assetB] = [assetOut, assetIn];
        const poolId = await this.getPoolIdByAssets(assetA.index, assetB.index);
        const state = await this.getPoolState(poolId);
        if (state['a'] != assetA.index || state['b'] != assetB.index) {
            throw new Error('incorrect pair');
        }
        if (state['ra'] == 0 || state['rb'] == 0) return 0;
        const aSup = { amount: BigInt(state['ra']), decimals: assetA.decimals };
        const bSup = { amount: BigInt(state['rb']), decimals: assetB.decimals };

        let [inSup, outSup] = [aSup, bSup];
        if (assetIn.index > assetOut.index) [inSup, outSup] = [bSup, aSup];

        const ratio =
            Number(inSup.amount) /
            Math.pow(10, inSup.decimals) /
            (Number(outSup.amount) / Math.pow(10, outSup.decimals));

        return ratio;
    }

    /**
     * get pool ratio
     * @param state pool state
     * @param aDecimals decimals of asset A
     * @param bDecimals decimals of asset B
     * @returns
     */
    getPoolRatioByState(
        state: PoolState,
        aDecimals: number,
        bDecimals: number
    ) {
        if (state['ra'] == 0 || state['rb'] == 0) return 0;
        const aSup = { amount: BigInt(state['ra']), decimals: aDecimals };
        const bSup = { amount: BigInt(state['rb']), decimals: bDecimals };

        const ratio =
            Number(aSup.amount) /
            Math.pow(10, aSup.decimals) /
            (Number(bSup.amount) / Math.pow(10, bSup.decimals));

        return ratio;
    }

    /**
     * Get pool state
     * @param poolId id of pool
     * @returns
     */
    async getPoolState(poolId: number): Promise<PoolState | StablePoolState> {
        const appInfo = await this.client.getApplicationByID(poolId).do();
        const stateArray = appInfo['params']['global-state'];

        const state = decodeStateArray(stateArray);
        return state;
    }

    /**
     * Get all pool states
     * @returns
     */
    async getPoolStates() {
        const appAddress = algosdk.getApplicationAddress(this.appId);
        const appInfo = await this.client.accountInformation(appAddress).do();
        const createdApps = appInfo['created-apps'];
        const states: { [key: number]: PoolState } = {};
        createdApps.forEach((app: any) => {
            const id = app['id'];
            const stateArray = app['params']['global-state'];
            const state = decodeStateArray(stateArray);
            states[id] = state;
        });
        return states;
    }

    /**
     * get price impact when a user swaps A to B
     * @param assetA id of asset A
     * @param assetB id of asset B
     * @param inAmt input amout
     * @returns
     */
    async getPriceImpact(assetA: number, assetB: number, inAmt: number) {
        const poolId = await this.getPoolIdByAssets(assetA, assetB);
        const state = await this.getPoolState(poolId);
        let [inId, outId] = [assetA, assetB];
        if (assetA > assetB) [inId, outId] = [assetB, assetA];
        if (state['a'] != inId || state['b'] != outId) {
            throw new Error('incorrect pair');
        }
        const aSup = state['ra'];
        const bSup = state['rb'];
        let [inSup, outSup] = [aSup, bSup];
        if (assetA > assetB) [inSup, outSup] = [outSup, inSup];
        const pb = inSup / outSup;
        const pa = (inSup + inAmt) / ((inSup * outSup) / (inSup + inAmt));
        return (pa - pb) / pb;
    }

    /**
     * get price impact when a user swaps A to B by state
     * @param poolState pool state
     * @param assetA id of asset A
     * @param assetB id of asset B
     * @param inAmt input amout
     * @returns
     */
    getPriceImpactByState(
        poolState: PoolState,
        inId: number,
        outId: number,
        inAmt: number
    ) {
        const aSup = poolState['ra'];
        const bSup = poolState['rb'];
        let [inSup, outSup] = [aSup, bSup];
        if (inId > outId) [inSup, outSup] = [bSup, aSup];
        const pb = inSup / outSup;
        const pa = (inSup + inAmt) / ((inSup * outSup) / (inSup + inAmt));
        return (pa - pb) / pb;
    }

    /**
     * get price impact and swap amount when a user swaps A to B
     * @param assetA id of asset A
     * @param assetB id of asset B
     * @param inAmt input amout
     * @returns
     */
    async getSwapResults(
        inId: number,
        outId: number,
        amount: number | bigint
    ): Promise<{ swapOutput: bigint; swapInput: bigint }> {
        let [assetA, assetB] = [inId, outId];
        if (inId > outId) [assetA, assetB] = [outId, inId];
        const poolId = await this.getPoolIdByAssets(assetA, assetB);
        const state = await this.getPoolState(poolId);
        if (state['a'] != assetA || state['b'] != assetB) {
            throw new Error('incorrect pair');
        }
        const aSup = state['ra'];
        const bSup = state['rb'];
        let [inSup, outSup] = [aSup, bSup];
        if (inId > outId) [inSup, outSup] = [bSup, aSup];

        const swapOutput =
            (BigInt(amount) * BigInt(1000 - 3) * BigInt(outSup)) /
            (BigInt(inSup * 1000) + BigInt(amount) * BigInt(1000 - 3));
        const swapInput =
            (BigInt(amount) * BigInt(inSup) * BigInt(1000)) /
            (BigInt(1000 - 3) * (BigInt(outSup) - BigInt(amount)));
        return {
            swapOutput,
            swapInput
        };
    }

    getSwapResultsByState(
        inId: number,
        outId: number,
        state: PoolState,
        amount: number | bigint
    ) {
        let [assetA, assetB] = [inId, outId];
        if (inId > outId) [assetA, assetB] = [outId, inId];
        if (state['a'] != assetA || state['b'] != assetB) {
            throw new Error('incorrect pair');
        }
        const aSup = state['ra'];
        const bSup = state['rb'];
        let [inSup, outSup] = [aSup, bSup];
        if (inId > outId) [inSup, outSup] = [bSup, aSup];

        const swapOutput =
            (BigInt(amount) * BigInt(1000 - 3) * BigInt(outSup)) /
            (BigInt(inSup * 1000) + BigInt(amount) * BigInt(1000 - 3));
        const swapInput =
            (BigInt(amount) * BigInt(inSup) * BigInt(1000)) /
            (BigInt(1000 - 3) * (BigInt(outSup) - BigInt(amount)));

        return {
            swapOutput,
            swapInput
        };
    }

    private async getTmpPoolId(): Promise<number> {
        const state = await this.getAppState();
        return state['tp'];
    }

    private async getTmpStablePoolId(): Promise<number> {
        const state = await this.getAppState();
        return state['tsp'];
    }

    private async getAppState() {
        const appInfo = await this.client.getApplicationByID(this.appId).do();
        const stateArray = appInfo['params']['global-state'];
        const state = decodeStateArray(stateArray);
        return state;
    }

    private async checkIsPoolExist(assetA: number, assetB: number) {
        try {
            const poolId = await this.getPoolIdByAssets(assetA, assetB);
            if (poolId) return true;
            else return false;
        } catch (e) {
            return false;
        }
    }

    private async getAsset(assetId: number) {
        if (this.assetsCache[assetId]) {
            return this.assetsCache[assetId];
        } else {
            const asset = await this.client.getAssetByID(assetId).do();
            this.assetsCache[assetId] = asset as any;
            return asset;
        }
    }
}
