"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALGO = exports.ClientType = exports.Node = void 0;
var Node;
(function (Node) {
    Node["SANDBOX"] = "sandbox";
    Node["TESTNET"] = "testnet";
    Node["BETANET"] = "betanet";
    Node["MAINNET"] = "mainnet";
})(Node = exports.Node || (exports.Node = {}));
var ClientType;
(function (ClientType) {
    ClientType[ClientType["Algod"] = 0] = "Algod";
    ClientType[ClientType["Indexer"] = 1] = "Indexer";
})(ClientType = exports.ClientType || (exports.ClientType = {}));
exports.ALGO = {
    id: 0,
    name: 'ALGO',
    unitName: 'ALGO',
    decimals: 6
};
