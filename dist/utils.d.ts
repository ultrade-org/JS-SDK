import { ABIContract, ABIMethod } from 'algosdk';
export declare function sqrt(value: bigint): bigint;
export declare function getMethodByName(contract: ABIContract, name: string): ABIMethod;
export declare function decodeStateArray(stateArray: any[]): any;
