export type IAssetAmt = {
    assetA: bigint;
    assetB: bigint;
};
export interface TokenPair {
    aId: number;
    aName: string;
    aUnitName: string;
    aDecimals: number;
    bId: number;
    bName: string;
    bUnitName: string;
    bDecimals: number;
    poolId: number;
    poolToken: number;
    poolState: PoolState;
}
export interface IndexerAssetParams {
    creator: string;
    decimals: number;
    'default-frozen': boolean;
    name: string;
    'name-b64': string;
    total: number;
    'unit-name': string;
    'unit-name-b64': string;
}
export interface IndexerAsset {
    index: number;
    params: IndexerAssetParams;
}
export interface AssetList {
    [key: number]: IndexerAsset;
}
export interface PoolList {
    [key: string]: TokenPair;
}
export interface InstanceParams {
    server?: string;
    token?: string;
    port?: string;
}
export interface PoolState {
    a: number;
    b: number;
    fo: number;
    ra: number;
    rb: number;
    set: number;
    p: number;
    gov: string;
    ma: number;
}
