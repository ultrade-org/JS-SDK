"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeStateArray = exports.getMethodByName = exports.sqrt = void 0;
const algosdk_1 = require("algosdk");
function sqrt(value) {
    if (value < BigInt(0)) {
        throw 'square root of negative numbers is not supported';
    }
    if (value < BigInt(2)) {
        return value;
    }
    function newtonIteration(n, x0) {
        const x1 = (BigInt(n / x0) + x0) >> BigInt(1);
        if (x0 === x1 || x0 === x1 - BigInt(1)) {
            return x0;
        }
        return newtonIteration(n, x1);
    }
    return newtonIteration(value, BigInt(1));
}
exports.sqrt = sqrt;
function getMethodByName(contract, name) {
    const m = contract.methods.find((mt) => {
        return mt.name == name;
    });
    if (m === undefined)
        throw Error('Method undefined: ' + name);
    return m;
}
exports.getMethodByName = getMethodByName;
function decodeStateArray(stateArray) {
    const state = {};
    stateArray.forEach((pair) => {
        const key = Buffer.from(pair['key'], 'base64');
        let value = pair['value'];
        const valueType = value['type'];
        if (valueType == 2)
            value = value['uint'];
        if (valueType == 1)
            value = Buffer.from(value['bytes']);
        if (key.toString() == 'gov') {
            state['gov'] = (0, algosdk_1.encodeAddress)(value);
        }
        else {
            state[key.toString()] = value;
        }
    });
    return state;
}
exports.decodeStateArray = decodeStateArray;
