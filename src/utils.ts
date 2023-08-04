import { ABIContract, ABIMethod, encodeAddress } from 'algosdk';

export function sqrt(value: bigint) {
    if (value < BigInt(0)) {
        throw 'square root of negative numbers is not supported';
    }

    if (value < BigInt(2)) {
        return value;
    }

    function newtonIteration(n: bigint, x0: bigint): bigint {
        const x1 = (BigInt(n / x0) + x0) >> BigInt(1);
        if (x0 === x1 || x0 === x1 - BigInt(1)) {
            return x0;
        }
        return newtonIteration(n, x1);
    }

    return newtonIteration(value, BigInt(1));
}

export function getMethodByName(
    contract: ABIContract,
    name: string
): ABIMethod {
    const m = contract.methods.find((mt: ABIMethod) => {
        return mt.name == name;
    });
    if (m === undefined) throw Error('Method undefined: ' + name);
    return m;
}

export function decodeStateArray(stateArray: any[]) {
    const state: any = {};

    stateArray.forEach((pair: { [x: string]: any }) => {
        const key = Buffer.from(pair['key'], 'base64');

        let value = pair['value'];
        const valueType = value['type'];
        if (valueType == 2) value = value['uint'];
        if (valueType == 1) value = Buffer.from(value['bytes']);

        if (key.toString() == 'gov') {
            state['gov'] = encodeAddress(value);
        } else if (key.toString() == 'pt') {
            state['pt'] = value.toString();
            console.log('POOL TYPE DECODED', value.toString());
        } else {
            state[key.toString()] = value;
        }
    });

    return state;
}
