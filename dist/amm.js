"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmmClient = exports.PendingTxnResponse = void 0;
const algosdk_1 = __importDefault(require("algosdk"));
const master_1 = require("./artifacts/master");
const pool_1 = require("./artifacts/pool");
const stable_1 = require("./artifacts/stable");
const constants_1 = require("./constants");
const utils_1 = require("./utils");
class PendingTxnResponse {
    constructor(response) {
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
exports.PendingTxnResponse = PendingTxnResponse;
class AmmClient {
    /**
     * construct AmmClient
     *
     * @param appId master app id
     * @param cluster one of node
     */
    constructor(appId, client) {
        this.client = client;
        this.appId = appId;
        this.masterContract = new algosdk_1.default.ABIContract(master_1.MASTER_ABI);
        this.poolContract = new algosdk_1.default.ABIContract(pool_1.POOL_ABI);
        this.stableContract = new algosdk_1.default.ABIContract(stable_1.STABLE_ABI);
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
    getStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            const status = yield this.client.status().do();
            return status;
        });
    }
    /**
     * check if an asset is stable coin.
     *
     * @returns
     */
    isStableAsset(asset) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const boxName = algosdk_1.default.encodeUint64(asset);
                const box = yield this.client
                    .getApplicationBoxByName(this.appId, boxName)
                    .do();
                const flag = algosdk_1.default.decodeUint64(box.value, 'safe');
                return flag != 0;
            }
            catch (e) {
                return false;
            }
        });
    }
    /**
     * Returns the common needed parameters for a new transaction.
     *
     * @returns
     */
    getTransactionParams() {
        return __awaiter(this, void 0, void 0, function* () {
            const params = yield this.client.getTransactionParams().do();
            return params;
        });
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
    createPair(sender, assetA, assetB, signer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (assetA > assetB)
                [assetA, assetB] = [assetB, assetA];
            const isPoolExist = yield this.checkIsPoolExist(assetA, assetB);
            if (isPoolExist) {
                throw new Error('pool already created');
            }
            try {
                const f1 = yield this.isStableAsset(assetA);
                const f2 = yield this.isStableAsset(assetB);
                let tmpPoolId;
                if (f1 && f2) {
                    tmpPoolId = yield this.getTmpStablePoolId();
                }
                else {
                    tmpPoolId = yield this.getTmpPoolId();
                }
                const atc = new algosdk_1.default.AtomicTransactionComposer();
                const sp = yield this.client.getTransactionParams().do();
                const boxName = new Uint8Array([
                    ...algosdk_1.default.encodeUint64(assetA),
                    ...algosdk_1.default.encodeUint64(assetB)
                ]);
                const appInfo = yield this.client
                    .getApplicationByID(this.appId)
                    .do();
                const appCreator = appInfo.params.creator;
                atc.addMethodCall({
                    appID: this.appId,
                    method: (0, utils_1.getMethodByName)(this.masterContract, 'create_pool'),
                    methodArgs: [
                        {
                            txn: algosdk_1.default.makePaymentTxnWithSuggestedParamsFromObject({
                                from: sender,
                                suggestedParams: sp,
                                to: algosdk_1.default.getApplicationAddress(this.appId),
                                amount: 3324100
                            }),
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
                            name: algosdk_1.default.encodeUint64(assetA)
                        },
                        { appIndex: this.appId, name: algosdk_1.default.encodeUint64(assetB) }
                    ],
                    sender: sender,
                    suggestedParams: Object.assign(Object.assign({}, sp), { flatFee: true, fee: 12000 }),
                    signer
                });
                const res = yield atc.execute(this.client, 4);
                return res;
            }
            catch (e) {
                throw new Error('create pair failed: ' + e.message);
            }
        });
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
    addLiquidity(sender, aId, aAmt, bId, bAmt, mintAmt, signer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (aId > bId) {
                [aId, bId] = [bId, aId];
                [aAmt, bAmt] = [bAmt, aAmt];
            }
            if (aAmt <= 1000 || bAmt <= 1000) {
                throw new Error('too small amount');
            }
            const poolId = yield this.getPoolIdByAssets(aId, bId);
            const state = yield this.getPoolState(poolId);
            if (state['a'] != aId || state['b'] != bId) {
                throw new Error('incorrect pair');
            }
            const params = yield this.client.getTransactionParams().do();
            const poolAddress = algosdk_1.default.getApplicationAddress(poolId);
            const poolToken = state['p'];
            const atc = new algosdk_1.default.AtomicTransactionComposer();
            if (!(yield this.isOptedInAsset(poolToken, sender))) {
                atc.addTransaction({
                    txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                        from: sender,
                        suggestedParams: params,
                        to: sender,
                        amount: 0,
                        assetIndex: poolToken
                    }),
                    signer
                });
            }
            const sp = yield this.client.getTransactionParams().do();
            const firstMint = state['ra'] == 0 && state['rb'] == 0;
            const sf1 = yield this.isStableAsset(aId);
            const sf2 = yield this.isStableAsset(bId);
            if (firstMint) {
                if (aId == 0) {
                    atc.addMethodCall({
                        sender,
                        appID: poolId,
                        method: (0, utils_1.getMethodByName)(this.poolContract, 'fund'),
                        methodArgs: [
                            {
                                txn: algosdk_1.default.makePaymentTxnWithSuggestedParamsFromObject({
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt
                                }),
                                signer
                            },
                            {
                                txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                                    amount: bAmt,
                                    from: sender,
                                    suggestedParams: params,
                                    to: poolAddress,
                                    assetIndex: bId
                                }),
                                signer
                            }
                        ],
                        appForeignAssets: [bId, poolToken],
                        suggestedParams: Object.assign(Object.assign({}, sp), { flatFee: true, fee: 2000 }),
                        signer
                    });
                    const res = yield atc.execute(this.client, 4);
                    return res;
                }
                else {
                    let method;
                    if (sf1 && sf2) {
                        method = (0, utils_1.getMethodByName)(this.stableContract, 'fund');
                    }
                    else {
                        method = (0, utils_1.getMethodByName)(this.poolContract, 'fund');
                    }
                    atc.addMethodCall({
                        sender,
                        appID: poolId,
                        method,
                        methodArgs: [
                            {
                                txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt,
                                    assetIndex: aId
                                }),
                                signer
                            },
                            {
                                txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                                    amount: bAmt,
                                    from: sender,
                                    suggestedParams: params,
                                    to: poolAddress,
                                    assetIndex: bId
                                }),
                                signer
                            }
                        ],
                        appForeignAssets: [aId, bId, poolToken],
                        suggestedParams: Object.assign(Object.assign({}, sp), { flatFee: true, fee: 2000 }),
                        signer
                    });
                    const res = yield atc.execute(this.client, 4);
                    return res;
                }
            }
            else {
                if (aId == 0) {
                    atc.addMethodCall({
                        sender,
                        appID: poolId,
                        method: (0, utils_1.getMethodByName)(this.poolContract, 'mint'),
                        methodArgs: [
                            {
                                txn: algosdk_1.default.makePaymentTxnWithSuggestedParamsFromObject({
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt
                                }),
                                signer
                            },
                            {
                                txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                                    amount: bAmt,
                                    from: sender,
                                    suggestedParams: params,
                                    to: poolAddress,
                                    assetIndex: bId
                                }),
                                signer
                            },
                            mintAmt
                        ],
                        appForeignAssets: [bId, poolToken],
                        suggestedParams: Object.assign(Object.assign({}, sp), { flatFee: true, fee: 4000 }),
                        signer
                    });
                    const res = yield atc.execute(this.client, 4);
                    return res;
                }
                else {
                    let method;
                    let methodArgs;
                    if (sf1 && sf2) {
                        method = (0, utils_1.getMethodByName)(this.stableContract, 'mint');
                        methodArgs = [aAmt, bAmt, mintAmt];
                        if (aAmt == 0) {
                            methodArgs.push({
                                txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: bAmt,
                                    assetIndex: bId
                                }),
                                signer
                            });
                        }
                        else if (bAmt == 0) {
                            methodArgs.push({
                                txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt,
                                    assetIndex: aId
                                }),
                                signer
                            });
                        }
                        else {
                            methodArgs.push({
                                txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt,
                                    assetIndex: aId
                                }),
                                signer
                            });
                            methodArgs.push({
                                txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: bAmt,
                                    assetIndex: bId
                                }),
                                signer
                            });
                        }
                    }
                    else {
                        method = (0, utils_1.getMethodByName)(this.poolContract, 'mint');
                        methodArgs = [
                            {
                                txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                                    from: sender,
                                    suggestedParams: sp,
                                    to: poolAddress,
                                    amount: aAmt,
                                    assetIndex: aId
                                }),
                                signer
                            },
                            {
                                txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                                    amount: bAmt,
                                    from: sender,
                                    suggestedParams: params,
                                    to: poolAddress,
                                    assetIndex: bId
                                }),
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
                        suggestedParams: Object.assign(Object.assign({}, sp), { flatFee: true, fee: 4000 }),
                        signer
                    });
                    const res = yield atc.execute(this.client, 4);
                    return res;
                }
            }
        });
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
    removeLiquidity(sender, poolId, poolTokenAmt, aMinAmt, bMinAmt, signer) {
        return __awaiter(this, void 0, void 0, function* () {
            const poolState = yield this.getPoolState(poolId);
            const poolTokenId = poolState['p'];
            const poolTokenBalance = yield this.getBalance(poolTokenId, sender);
            if (poolTokenBalance < poolTokenAmt)
                throw new Error('insufficient pool token balance');
            const sp = yield this.client.getTransactionParams().do();
            const foreignAssets = poolState['a'] == 0
                ? [poolTokenId, poolState['b']]
                : [poolTokenId, poolState['a'], poolState['b']];
            const sf1 = yield this.isStableAsset(poolState['a']);
            const sf2 = yield this.isStableAsset(poolState['b']);
            let method;
            if (sf1 && sf2) {
                method = (0, utils_1.getMethodByName)(this.poolContract, 'burn');
            }
            else {
                method = (0, utils_1.getMethodByName)(this.stableContract, 'burn');
            }
            const atc = new algosdk_1.default.AtomicTransactionComposer();
            atc.addMethodCall({
                sender,
                appID: poolId,
                method,
                methodArgs: [
                    {
                        txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                            amount: poolTokenAmt,
                            from: sender,
                            suggestedParams: sp,
                            to: algosdk_1.default.getApplicationAddress(poolId),
                            assetIndex: poolTokenId
                        }),
                        signer
                    },
                    aMinAmt,
                    bMinAmt
                ],
                appForeignAssets: foreignAssets,
                suggestedParams: Object.assign(Object.assign({}, sp), { flatFee: true, fee: 4000 }),
                signer
            });
            const res = yield atc.execute(this.client, 4);
            return res;
        });
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
    swap(sender, inId, inAmt, outId, slippage, signer) {
        return __awaiter(this, void 0, void 0, function* () {
            let [assetIn, assetOut] = [inId, outId];
            if (assetIn > assetOut)
                [assetIn, assetOut] = [assetOut, assetIn];
            const poolId = yield this.getPoolIdByAssets(assetIn, assetOut);
            const poolAddress = algosdk_1.default.getApplicationAddress(poolId);
            let poolState = yield this.getPoolState(poolId);
            const poolToken = poolState['p'];
            const outAmt = this.getSwapOutputByState(inId, outId, poolState, inAmt);
            const minSwapAmt = (BigInt(outAmt) * (BigInt(100000) - BigInt(slippage * 1000))) /
                BigInt(100000);
            const params = yield this.client.getTransactionParams().do();
            const atc = new algosdk_1.default.AtomicTransactionComposer();
            if (!(yield this.isOptedInAsset(outId, sender))) {
                atc.addTransaction({
                    txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
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
                    method: (0, utils_1.getMethodByName)(this.poolContract, 'swap'),
                    methodArgs: [
                        {
                            txn: algosdk_1.default.makePaymentTxnWithSuggestedParamsFromObject({
                                from: sender,
                                suggestedParams: params,
                                to: poolAddress,
                                amount: inAmt
                            }),
                            signer
                        },
                        minSwapAmt
                    ],
                    appForeignAssets: foreignAssets,
                    suggestedParams: Object.assign(Object.assign({}, params), { flatFee: true, fee: 2000 }),
                    signer
                });
                const res = yield atc.execute(this.client, 4);
                return res;
            }
            else {
                let foreignAssets;
                if (inId < outId) {
                    foreignAssets = [inId, outId, poolToken];
                }
                else {
                    foreignAssets = [outId, inId, poolToken];
                }
                atc.addMethodCall({
                    sender,
                    appID: poolId,
                    method: (0, utils_1.getMethodByName)(this.poolContract, 'swap'),
                    methodArgs: [
                        {
                            txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                                from: sender,
                                suggestedParams: params,
                                to: poolAddress,
                                amount: inAmt,
                                assetIndex: inId
                            }),
                            signer
                        },
                        minSwapAmt
                    ],
                    appForeignAssets: foreignAssets,
                    suggestedParams: Object.assign(Object.assign({}, params), { flatFee: true, fee: 2000 }),
                    signer
                });
                const res = yield atc.execute(this.client, 4);
                return res;
            }
        });
    }
    /**
     * get LP token by asset A and B
     *
     * @param assetA
     * @param assetB
     * @returns
     */
    getPoolToken(assetA, assetB) {
        return __awaiter(this, void 0, void 0, function* () {
            const poolId = yield this.getPoolIdByAssets(assetA, assetB);
            const state = yield this.getPoolState(poolId);
            if (state['a'] != assetA || state['b'] != assetB) {
                throw new Error('incorrect pair');
            }
            return state['p'];
        });
    }
    /**
     * get pool app id by asset A and B
     *
     * @param assetA
     * @param assetB
     * @returns
     */
    getPoolIdByAssets(assetA, assetB) {
        return __awaiter(this, void 0, void 0, function* () {
            if (assetA > assetB)
                [assetA, assetB] = [assetB, assetA];
            const cachedId = String(assetA) + String(assetB);
            if (this.poolsCache[cachedId])
                return this.poolsCache[cachedId].poolId;
            else {
                const boxName = new Uint8Array([
                    ...algosdk_1.default.encodeUint64(assetA),
                    ...algosdk_1.default.encodeUint64(assetB)
                ]);
                const box = yield this.client
                    .getApplicationBoxByName(this.appId, boxName)
                    .do();
                const poolId = algosdk_1.default.decodeUint64(box.value, 'safe');
                return poolId;
            }
        });
    }
    /**
     * get pool app id by LP token
     * @param tokenId
     * @returns
     */
    getPoolByToken(tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pair = Object.values(this.poolsCache).find((pair) => pair.poolState['p'] == tokenId);
            if (pair)
                return pair;
            else {
                const pairs = yield this.getPairs();
                const idx = pairs.findIndex((pair) => pair.poolState['p'] == tokenId);
                if (idx == -1)
                    throw new Error('non-exist pool');
                const correctPair = pairs[idx];
                return correctPair;
            }
        });
    }
    /**
     * Get pool by asset A id and asset B id
     * @param assetA
     * @param assetB
     * @returns
     */
    getPoolByAssets(assetA, assetB) {
        return __awaiter(this, void 0, void 0, function* () {
            if (assetA > assetB)
                [assetA, assetB] = [assetB, assetA];
            const cachedId = String(assetA) + String(assetB);
            if (this.poolsCache[cachedId]) {
                const poolState = yield this.getPoolState(this.poolsCache[cachedId].poolId);
                return Object.assign(Object.assign({}, this.poolsCache[cachedId]), { poolState });
            }
            else {
                const boxName = new Uint8Array([
                    ...algosdk_1.default.encodeUint64(assetA),
                    ...algosdk_1.default.encodeUint64(assetB)
                ]);
                const box = yield this.client
                    .getApplicationBoxByName(this.appId, boxName)
                    .do();
                const poolId = algosdk_1.default.decodeUint64(box.value, 'safe');
                const poolState = yield this.getPoolState(poolId);
                const poolToken = poolState['p'];
                let aa;
                if (assetA == 0) {
                    aa = {
                        params: {
                            name: constants_1.ALGO.name,
                            decimals: constants_1.ALGO.decimals,
                            'unit-name': constants_1.ALGO.unitName
                        }
                    };
                }
                else {
                    aa = yield this.getAsset(assetA);
                }
                const bb = yield this.getAsset(assetB);
                const pair = {
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
        });
    }
    /**
     * get all pools
     *
     * @returns
     */
    getPairs() {
        return __awaiter(this, void 0, void 0, function* () {
            const appAddress = algosdk_1.default.getApplicationAddress(this.appId);
            const appInfo = yield this.client.accountInformation(appAddress).do();
            const createdApps = appInfo['created-apps'];
            let pools = [];
            for (const app of createdApps) {
                const poolId = app['id'];
                const stateArray = app['params']['global-state'];
                const poolState = (0, utils_1.decodeStateArray)(stateArray);
                const aId = poolState['a'];
                const bId = poolState['b'];
                const poolToken = poolState['p'];
                const type = poolState['pt'] || 'CONSTANT_PRODUCT';
                const fee = poolState['f'] || 20;
                const cachedId = String(aId) + String(bId);
                const cachedPool = this.poolsCache[cachedId];
                if (cachedPool) {
                    pools.push(Object.assign(Object.assign({}, cachedPool), { poolToken, poolId, poolState }));
                }
                else {
                    let assetA;
                    if (aId == 0) {
                        assetA = {
                            params: {
                                decimals: constants_1.ALGO.decimals,
                                name: constants_1.ALGO.name,
                                'unit-name': constants_1.ALGO.unitName
                            }
                        };
                    }
                    else {
                        assetA = yield this.getAsset(aId);
                    }
                    const assetB = yield this.getAsset(bId);
                    const pool = {
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
        });
    }
    /**
     * get balances of an address
     *
     * @param address
     * @returns
     */
    getBalances(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountInfo = yield this.client.accountInformation(address).do();
            const balances = {
                '0': accountInfo['amount']
            };
            const assets = accountInfo['assets'];
            for (let i = 0; i < assets.length; i++) {
                const assetId = assets[i]['asset-id'];
                const assetAmt = assets[i]['amount'];
                balances[assetId] = assetAmt;
            }
            return balances;
        });
    }
    /**
     * get balance of an address per asset
     *
     * @param assetId
     * @param address
     * @returns
     */
    getBalance(assetId, address) {
        return __awaiter(this, void 0, void 0, function* () {
            const balances = yield this.getBalances(address);
            return balances[assetId.toString()];
        });
    }
    /**
     * check if an address opted in an asset
     *
     * @param assetId
     * @param addr
     * @returns
     */
    isOptedInAsset(assetId, addr) {
        return __awaiter(this, void 0, void 0, function* () {
            const balances = yield this.getBalances(addr);
            return Object.keys(balances).includes(assetId.toString());
        });
    }
    /**
     * get assets of addr
     *
     * @param addr
     * @returns
     */
    getAssetList(addr) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountInfo = yield this.client.accountInformation(addr).do();
            const as = accountInfo['assets'];
            const assetList = [];
            for (let i = 0; i < as.length; i++) {
                const a = as[i];
                try {
                    const b = yield this.client.getAssetByID(a['asset-id']).do();
                    assetList.push({
                        id: b['index'],
                        name: b['params']['unit-name']
                    });
                }
                catch (e) {
                    console.log(e);
                }
            }
            return assetList;
        });
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
    getSwapOutputByState(assetIn, assetOut, state, amtIn) {
        const aSup = state['ra'];
        const bSup = state['rb'];
        let [inSup, outSup] = [aSup, bSup];
        if (assetIn > assetOut)
            [inSup, outSup] = [bSup, aSup];
        const amtOut = (BigInt(amtIn) * BigInt(1000 - 3) * BigInt(outSup)) /
            (BigInt(inSup) * BigInt(1000) + BigInt(amtIn) * BigInt(1000 - 3));
        return amtOut;
    }
    /**
     * get output amount after swap
     *
     * @param txId transaction id
     * @returns
     */
    getAmountAfterSwap(txId) {
        return __awaiter(this, void 0, void 0, function* () {
            const txnInfo = yield this.client
                .pendingTransactionInformation(txId)
                .do();
            const res = new PendingTxnResponse(txnInfo);
            if (res.logs.length) {
                return algosdk_1.default.decodeUint64(res.logs[0], 'safe');
            }
            else {
                throw new Error('no swap transaction');
            }
        });
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
    getMintAmt(assetA, assetAAmt, assetB, assetBAmt) {
        return __awaiter(this, void 0, void 0, function* () {
            if (assetA > assetB) {
                [assetA, assetB] = [assetB, assetA];
                [assetAAmt, assetBAmt] = [assetBAmt, assetAAmt];
            }
            const poolId = yield this.getPoolIdByAssets(assetA, assetB);
            const state = yield this.getPoolState(poolId);
            if (state['a'] != assetA || state['b'] != assetB) {
                throw new Error('incorrect pair');
            }
            const reserveA = BigInt(state['ra']);
            const reserveB = BigInt(state['rb']);
            const issued = BigInt(state['ma']);
            if (reserveA == BigInt(0) && reserveB == BigInt(0)) {
                // on_fund
                const scale = BigInt(1000);
                return (0, utils_1.sqrt)(BigInt(assetAAmt) * BigInt(assetBAmt)) - scale;
            }
            else {
                // on_mint
                if (BigInt(assetAAmt) * reserveB < BigInt(assetBAmt) * reserveA) {
                    return (BigInt(assetAAmt) * issued) / reserveA;
                }
                else {
                    return (BigInt(assetBAmt) * issued) / reserveB;
                }
            }
        });
    }
    /**
     * Get liquidity token amounts by pool state
     *
     * @param state pool state
     * @param assetAAmt amount of asset A
     * @param assetBAmt amount of asset B to send the A-B pool
     * @returns int
     */
    getMintAmtByState(state, assetAAmt, assetBAmt) {
        const reserveA = BigInt(state['ra']);
        const reserveB = BigInt(state['rb']);
        const issued = BigInt(state['ma']);
        if (reserveA == BigInt(0) && reserveB == BigInt(0)) {
            // on_fund
            const scale = BigInt(1000);
            return (0, utils_1.sqrt)(BigInt(assetAAmt) * BigInt(assetBAmt)) - scale;
        }
        else {
            // on_mint
            if (BigInt(assetAAmt) * reserveB < BigInt(assetBAmt) * reserveA) {
                return (BigInt(assetAAmt) * issued) / reserveA;
            }
            else {
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
    prepareOptInTxn(sender, assetId, signer) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = yield this.client.getTransactionParams().do();
            const atc = new algosdk_1.default.AtomicTransactionComposer();
            atc.addTransaction({
                txn: algosdk_1.default.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    amount: 0,
                    from: sender,
                    suggestedParams: params,
                    to: sender,
                    assetIndex: assetId
                }),
                signer
            });
            const res = yield atc.execute(this.client, 4);
            return res;
        });
    }
    /**
     * Get assets amounts after pool token burn
     *
     * @param assetA id of asset A
     * @param assetB id of asset B
     * @param burnAmt burn amount
     * @returns
     */
    getAssetAmtAfterBurnLP(assetA, assetB, burnAmt) {
        return __awaiter(this, void 0, void 0, function* () {
            const poolId = yield this.getPoolIdByAssets(assetA, assetB);
            const state = yield this.getPoolState(poolId);
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
        });
    }
    /**
     * Get assets amounts after pool token burn by state
     *
     * @param state pool state
     * @param burnAmt burn amount
     * @returns
     */
    getAssetAmtAfterBurnLPByState(state, burnAmt) {
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
    getSwapInput(assetIn, assetOut, amtOut) {
        return __awaiter(this, void 0, void 0, function* () {
            let [assetA, assetB] = [assetIn, assetOut];
            if (assetIn > assetOut)
                [assetA, assetB] = [assetOut, assetIn];
            const poolId = yield this.getPoolIdByAssets(assetA, assetB);
            const state = yield this.getPoolState(poolId);
            if (state['a'] != assetA || state['b'] != assetB) {
                throw new Error('incorrect pair');
            }
            const aSup = state['ra'];
            const bSup = state['rb'];
            let [inSup, outSup] = [aSup, bSup];
            if (assetIn > assetOut)
                [inSup, outSup] = [bSup, aSup];
            const amtIn = (BigInt(amtOut) * BigInt(inSup) * BigInt(1000)) /
                (BigInt(1000 - 3) * (BigInt(outSup) - BigInt(amtOut))) +
                BigInt(1);
            return amtIn;
        });
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
    getSwapInputByState(assetIn, assetOut, state, amtOut) {
        const aSup = state['ra'];
        const bSup = state['rb'];
        let [inSup, outSup] = [aSup, bSup];
        if (assetIn > assetOut)
            [inSup, outSup] = [bSup, aSup];
        const amtIn = (BigInt(amtOut) * BigInt(inSup) * BigInt(1000)) /
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
    getPoolRatio(assetIn, assetOut) {
        return __awaiter(this, void 0, void 0, function* () {
            let [assetA, assetB] = [assetIn, assetOut];
            if (assetIn.index > assetOut.index)
                [assetA, assetB] = [assetOut, assetIn];
            const poolId = yield this.getPoolIdByAssets(assetA.index, assetB.index);
            const state = yield this.getPoolState(poolId);
            if (state['a'] != assetA.index || state['b'] != assetB.index) {
                throw new Error('incorrect pair');
            }
            if (state['ra'] == 0 || state['rb'] == 0)
                return 0;
            const aSup = { amount: BigInt(state['ra']), decimals: assetA.decimals };
            const bSup = { amount: BigInt(state['rb']), decimals: assetB.decimals };
            let [inSup, outSup] = [aSup, bSup];
            if (assetIn.index > assetOut.index)
                [inSup, outSup] = [bSup, aSup];
            const ratio = Number(inSup.amount) /
                Math.pow(10, inSup.decimals) /
                (Number(outSup.amount) / Math.pow(10, outSup.decimals));
            return ratio;
        });
    }
    /**
     * get pool ratio
     * @param state pool state
     * @param aDecimals decimals of asset A
     * @param bDecimals decimals of asset B
     * @returns
     */
    getPoolRatioByState(state, aDecimals, bDecimals) {
        if (state['ra'] == 0 || state['rb'] == 0)
            return 0;
        const aSup = { amount: BigInt(state['ra']), decimals: aDecimals };
        const bSup = { amount: BigInt(state['rb']), decimals: bDecimals };
        const ratio = Number(aSup.amount) /
            Math.pow(10, aSup.decimals) /
            (Number(bSup.amount) / Math.pow(10, bSup.decimals));
        return ratio;
    }
    /**
     * Get pool state
     * @param poolId id of pool
     * @returns
     */
    getPoolState(poolId) {
        return __awaiter(this, void 0, void 0, function* () {
            const appInfo = yield this.client.getApplicationByID(poolId).do();
            const stateArray = appInfo['params']['global-state'];
            const state = (0, utils_1.decodeStateArray)(stateArray);
            return state;
        });
    }
    /**
     * Get all pool states
     * @returns
     */
    getPoolStates() {
        return __awaiter(this, void 0, void 0, function* () {
            const appAddress = algosdk_1.default.getApplicationAddress(this.appId);
            const appInfo = yield this.client.accountInformation(appAddress).do();
            const createdApps = appInfo['created-apps'];
            const states = {};
            createdApps.forEach((app) => {
                const id = app['id'];
                const stateArray = app['params']['global-state'];
                const state = (0, utils_1.decodeStateArray)(stateArray);
                states[id] = state;
            });
            return states;
        });
    }
    /**
     * get price impact when a user swaps A to B
     * @param assetA id of asset A
     * @param assetB id of asset B
     * @param inAmt input amout
     * @returns
     */
    getPriceImpact(assetA, assetB, inAmt) {
        return __awaiter(this, void 0, void 0, function* () {
            const poolId = yield this.getPoolIdByAssets(assetA, assetB);
            const state = yield this.getPoolState(poolId);
            let [inId, outId] = [assetA, assetB];
            if (assetA > assetB)
                [inId, outId] = [assetB, assetA];
            if (state['a'] != inId || state['b'] != outId) {
                throw new Error('incorrect pair');
            }
            const aSup = state['ra'];
            const bSup = state['rb'];
            let [inSup, outSup] = [aSup, bSup];
            if (assetA > assetB)
                [inSup, outSup] = [outSup, inSup];
            const pb = inSup / outSup;
            const pa = (inSup + inAmt) / ((inSup * outSup) / (inSup + inAmt));
            return (pa - pb) / pb;
        });
    }
    /**
     * get price impact when a user swaps A to B by state
     * @param poolState pool state
     * @param assetA id of asset A
     * @param assetB id of asset B
     * @param inAmt input amout
     * @returns
     */
    getPriceImpactByState(poolState, inId, outId, inAmt) {
        const aSup = poolState['ra'];
        const bSup = poolState['rb'];
        let [inSup, outSup] = [aSup, bSup];
        if (inId > outId)
            [inSup, outSup] = [bSup, aSup];
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
    getSwapResults(inId, outId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            let [assetA, assetB] = [inId, outId];
            if (inId > outId)
                [assetA, assetB] = [outId, inId];
            const poolId = yield this.getPoolIdByAssets(assetA, assetB);
            const state = yield this.getPoolState(poolId);
            if (state['a'] != assetA || state['b'] != assetB) {
                throw new Error('incorrect pair');
            }
            const aSup = state['ra'];
            const bSup = state['rb'];
            let [inSup, outSup] = [aSup, bSup];
            if (inId > outId)
                [inSup, outSup] = [bSup, aSup];
            const swapOutput = (BigInt(amount) * BigInt(1000 - 3) * BigInt(outSup)) /
                (BigInt(inSup * 1000) + BigInt(amount) * BigInt(1000 - 3));
            const swapInput = (BigInt(amount) * BigInt(inSup) * BigInt(1000)) /
                (BigInt(1000 - 3) * (BigInt(outSup) - BigInt(amount)));
            return {
                swapOutput,
                swapInput
            };
        });
    }
    getSwapResultsByState(inId, outId, state, amount) {
        let [assetA, assetB] = [inId, outId];
        if (inId > outId)
            [assetA, assetB] = [outId, inId];
        if (state['a'] != assetA || state['b'] != assetB) {
            throw new Error('incorrect pair');
        }
        const aSup = state['ra'];
        const bSup = state['rb'];
        let [inSup, outSup] = [aSup, bSup];
        if (inId > outId)
            [inSup, outSup] = [bSup, aSup];
        const swapOutput = (BigInt(amount) * BigInt(1000 - 3) * BigInt(outSup)) /
            (BigInt(inSup * 1000) + BigInt(amount) * BigInt(1000 - 3));
        const swapInput = (BigInt(amount) * BigInt(inSup) * BigInt(1000)) /
            (BigInt(1000 - 3) * (BigInt(outSup) - BigInt(amount)));
        return {
            swapOutput,
            swapInput
        };
    }
    getTmpPoolId() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = yield this.getAppState();
            return state['tp'];
        });
    }
    getTmpStablePoolId() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = yield this.getAppState();
            return state['tsp'];
        });
    }
    getAppState() {
        return __awaiter(this, void 0, void 0, function* () {
            const appInfo = yield this.client.getApplicationByID(this.appId).do();
            const stateArray = appInfo['params']['global-state'];
            const state = (0, utils_1.decodeStateArray)(stateArray);
            return state;
        });
    }
    checkIsPoolExist(assetA, assetB) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const poolId = yield this.getPoolIdByAssets(assetA, assetB);
                if (poolId)
                    return true;
                else
                    return false;
            }
            catch (e) {
                return false;
            }
        });
    }
    getAsset(assetId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.assetsCache[assetId]) {
                return this.assetsCache[assetId];
            }
            else {
                const asset = yield this.client.getAssetByID(assetId).do();
                this.assetsCache[assetId] = asset;
                return asset;
            }
        });
    }
}
exports.AmmClient = AmmClient;
