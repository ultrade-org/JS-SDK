"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqrt = void 0;
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
