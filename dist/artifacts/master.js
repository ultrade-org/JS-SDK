"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MASTER_ABI = void 0;
exports.MASTER_ABI = {
    name: 'Master',
    methods: [
        {
            name: 'bootstrap',
            args: [
                {
                    type: 'application',
                    name: 'tmp_pool'
                },
                {
                    type: 'application',
                    name: 'tmp_stable_pool'
                }
            ],
            returns: {
                type: 'void'
            }
        },
        {
            name: 'add_stable_coin',
            args: [
                {
                    type: 'asset',
                    name: 'token'
                }
            ],
            returns: {
                type: 'void'
            }
        },
        {
            name: 'remove_stable_coin',
            args: [
                {
                    type: 'asset',
                    name: 'token'
                }
            ],
            returns: {
                type: 'void'
            }
        },
        {
            name: 'create_pool',
            args: [
                {
                    type: 'pay',
                    name: 'seed'
                },
                {
                    type: 'uint64',
                    name: 'asset_a'
                },
                {
                    type: 'uint64',
                    name: 'asset_b'
                }
            ],
            returns: {
                type: 'void'
            }
        },
        {
            name: 'set_governor',
            args: [
                {
                    type: 'uint64',
                    name: 'asset_a'
                },
                {
                    type: 'uint64',
                    name: 'asset_b'
                },
                {
                    type: 'account',
                    name: 'governor'
                }
            ],
            returns: {
                type: 'void'
            }
        }
    ],
    networks: {}
};
