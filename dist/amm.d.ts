import algosdk from 'algosdk';
import { AssetList, IAssetAmt, InstanceParams, PoolList, PoolState, TokenPair } from './types';
import { Node } from './constants';
export declare class PendingTxnResponse {
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
    constructor(response: Record<string, any>);
}
export declare class AmmClient {
    private client;
    private indexer;
    private appId;
    private masterContract;
    private poolContract;
    private stableContract;
    private assetsCache;
    private poolsCache;
    /**
     * construct AmmClient
     *
     * @param appId master app id
     * @param cluster one of node
     */
    constructor(appId: number, cluster: Node, params?: InstanceParams);
    getAssetCache(): AssetList;
    getPoolsCache(): PoolList;
    /**
     * get status of current node.
     *
     * @returns
     */
    getStatus(): Promise<Record<string, any>>;
    /**
     * check if an asset is stable coin.
     *
     * @returns
     */
    isStableAsset(asset: number): Promise<boolean>;
    /**
     * Returns the common needed parameters for a new transaction.
     *
     * @returns
     */
    getTransactionParams(): Promise<algosdk.SuggestedParams>;
    /**
     * returns Algodv2 instance.
     *
     * @returns
     */
    getAlgodClient(): algosdk.Algodv2;
    /**
     * create a pool for asset A and B.
     *
     * @param sender the sender of transaction
     * @param assetA
     * @param assetB
     * @returns
     */
    createPair(sender: string, assetA: number, assetB: number, signer: algosdk.TransactionSigner): Promise<{
        confirmedRound: number;
        txIDs: string[];
        methodResults: algosdk.ABIResult[];
    }>;
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
    addLiquidity(sender: string, aId: number, aAmt: number | bigint, bId: number, bAmt: number | bigint, mintAmt: number | bigint, signer: algosdk.TransactionSigner): Promise<{
        confirmedRound: number;
        txIDs: string[];
        methodResults: algosdk.ABIResult[];
    }>;
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
    removeLiquidity(sender: string, poolId: number, poolTokenAmt: number | bigint, aMinAmt: number | bigint, bMinAmt: number | bigint, signer: algosdk.TransactionSigner): Promise<{
        confirmedRound: number;
        txIDs: string[];
        methodResults: algosdk.ABIResult[];
    }>;
    /**
     * swap tokens
     *
     * @param sender the sender of transaction
     * @param inId asset id of input
     * @param inAmt input amount
     * @param outId asset id of output
     * @returns
     */
    swap(sender: string, inId: number, inAmt: number | bigint, outId: number, slippage: number, signer: algosdk.TransactionSigner): Promise<{
        confirmedRound: number;
        txIDs: string[];
        methodResults: algosdk.ABIResult[];
    }>;
    /**
     * get LP token by asset A and B
     *
     * @param assetA
     * @param assetB
     * @returns
     */
    getPoolToken(assetA: number, assetB: number): Promise<number>;
    /**
     * get pool app id by asset A and B
     *
     * @param assetA
     * @param assetB
     * @returns
     */
    getPoolIdByAssets(assetA: number, assetB: number): Promise<number>;
    /**
     * get pool app id by LP token
     * @param tokenId
     * @returns
     */
    getPoolByToken(tokenId: number): Promise<TokenPair>;
    /**
     * Get pool by asset A id and asset B id
     * @param assetA
     * @param assetB
     * @returns
     */
    getPoolByAssets(assetA: number, assetB: number): Promise<TokenPair>;
    /**
     * get all pools
     *
     * @returns
     */
    getPairs(): Promise<TokenPair[]>;
    /**
     * get balances of an address
     *
     * @param address
     * @returns
     */
    getBalances(address: string): Promise<any>;
    /**
     * get balance of an address per asset
     *
     * @param assetId
     * @param address
     * @returns
     */
    getBalance(assetId: number, address: string): Promise<number | bigint>;
    /**
     * check if an address opted in an asset
     *
     * @param assetId
     * @param addr
     * @returns
     */
    isOptedInAsset(assetId: number, addr: string): Promise<boolean>;
    /**
     * get assets of addr
     *
     * @param addr
     * @returns
     */
    getAssetList(addr: string): Promise<{
        id: any;
        name: any;
    }[]>;
    /**
     * get output amount when a user swap A to B
     *
     * @param assetIn id of input asset
     * @param assetOut id of output asset
     * @param state pool state
     * @param amtIn input amount
     * @returns
     */
    getSwapOutputByState(assetIn: number, assetOut: number, state: PoolState, amtIn: number | bigint): bigint;
    /**
     * get output amount after swap
     *
     * @param txId transaction id
     * @returns
     */
    getAmountAfterSwap(txId: string): Promise<number>;
    /**
     * Get liquidity token amounts
     *
     * @param assetA id of asset A to send the A-B pool
     * @param assetAAmt amount of asset A
     * @param assetB id of asset B
     * @param assetBAmt amount of asset B to send the A-B pool
     * @returns int
     */
    getMintAmt(assetA: number, assetAAmt: number | bigint, assetB: number, assetBAmt: number | bigint): Promise<bigint>;
    /**
     * Get liquidity token amounts by pool state
     *
     * @param state pool state
     * @param assetAAmt amount of asset A
     * @param assetBAmt amount of asset B to send the A-B pool
     * @returns int
     */
    getMintAmtByState(state: PoolState, assetAAmt: number | bigint, assetBAmt: number | bigint): bigint;
    /**
     * Make opt-in for asset/pool
     *
     * @param sender the sender of transaction
     * @param assetId id of asset/pool
     * @param signer transaction signer
     * @returns
     */
    prepareOptInTxn(sender: string, assetId: number, signer: algosdk.TransactionSigner): Promise<{
        confirmedRound: number;
        txIDs: string[];
        methodResults: algosdk.ABIResult[];
    }>;
    /**
     * Get assets amounts after pool token burn
     *
     * @param assetA id of asset A
     * @param assetB id of asset B
     * @param burnAmt burn amount
     * @returns
     */
    getAssetAmtAfterBurnLP(assetA: number, assetB: number, burnAmt: number): Promise<IAssetAmt>;
    /**
     * Get assets amounts after pool token burn by state
     *
     * @param state pool state
     * @param burnAmt burn amount
     * @returns
     */
    getAssetAmtAfterBurnLPByState(state: PoolState, burnAmt: number): {
        assetA: bigint;
        assetB: bigint;
    };
    /**
     * get input amount from output when a user swap A to B
     *
     * @param assetIn id of input asset
     * @param assetOut id of output asset
     * @param amtOut output amount
     * @returns
     */
    getSwapInput(assetIn: number, assetOut: number, amtOut: number | bigint): Promise<bigint>;
    /**
     * get input amount from output when a user swap A to B
     *
     * @param assetIn id of input asset
     * @param assetOut id of output asset
     * @param amtOut output amount
     * @param state pool state
     * @returns
     */
    getSwapInputByState(assetIn: number, assetOut: number, state: PoolState, amtOut: number | bigint): bigint;
    /**
     * get pool ratio
     * @param assetIn id of asset A
     * @param assetOut id of asset B
     * @returns
     */
    getPoolRatio(assetIn: {
        index: number;
        decimals: number;
    }, assetOut: {
        index: number;
        decimals: number;
    }): Promise<number>;
    /**
     * get pool ratio
     * @param state pool state
     * @param aDecimals decimals of asset A
     * @param bDecimals decimals of asset B
     * @returns
     */
    getPoolRatioByState(state: PoolState, aDecimals: number, bDecimals: number): number;
    /**
     * Get pool state
     * @param poolId id of pool
     * @returns
     */
    getPoolState(poolId: number): Promise<PoolState>;
    /**
     * Get all pool states
     * @returns
     */
    getPoolStates(): Promise<{
        [key: number]: string;
    }>;
    /**
     * get price impact when a user swaps A to B
     * @param assetA id of asset A
     * @param assetB id of asset B
     * @param inAmt input amout
     * @returns
     */
    getPriceImpact(assetA: number, assetB: number, inAmt: number): Promise<number>;
    /**
     * get price impact when a user swaps A to B by state
     * @param poolState pool state
     * @param assetA id of asset A
     * @param assetB id of asset B
     * @param inAmt input amout
     * @returns
     */
    getPriceImpactByState(poolState: PoolState, inId: number, outId: number, inAmt: number): number;
    /**
     * get price impact and swap amount when a user swaps A to B
     * @param assetA id of asset A
     * @param assetB id of asset B
     * @param inAmt input amout
     * @returns
     */
    getSwapResults(inId: number, outId: number, amount: number | bigint): Promise<{
        swapOutput: bigint;
        swapInput: bigint;
    }>;
    getSwapResultsByState(inId: number, outId: number, state: PoolState, amount: number | bigint): {
        swapOutput: bigint;
        swapInput: bigint;
    };
    private getTmpPoolId;
    private getTmpStablePoolId;
    private getAppState;
    private checkIsPoolExist;
    private getAsset;
}
