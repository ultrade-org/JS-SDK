export const STABLE_ABI = {
    name: 'StablePool',
    methods: [
        {
            name: 'set_governor',
            args: [
                {
                    type: 'account',
                    name: 'new_governor'
                }
            ],
            returns: {
                type: 'void'
            },
            desc: 'sets the governor of the contract, may only be called by the current governor'
        },
        {
            name: 'bootstrap',
            args: [
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
            },
            desc: 'bootstraps the contract by opting into the assets and creating the pool token.'
        },
        {
            name: 'fund',
            args: [
                {
                    type: 'axfer',
                    name: 'txn_a'
                },
                {
                    type: 'axfer',
                    name: 'txn_b'
                }
            ],
            returns: {
                type: 'void'
            }
        },
        {
            name: 'mint',
            args: [
                {
                    type: 'uint64',
                    name: 'a_amt'
                },
                {
                    type: 'uint64',
                    name: 'b_amt'
                },
                {
                    type: 'uint64',
                    name: 'min_out_amt'
                },
                {
                    type: 'axfer',
                    name: 'txn_a'
                },
                {
                    type: 'axfer',
                    name: 'txn_b'
                }
            ],
            returns: {
                type: 'void'
            }
        },
        {
            name: 'burn',
            args: [
                {
                    type: 'axfer',
                    name: 'txn'
                },
                {
                    type: 'uint64',
                    name: 'min_out_amt_a'
                },
                {
                    type: 'uint64',
                    name: 'min_out_amt_b'
                }
            ],
            returns: {
                type: 'void'
            }
        },
        {
            name: 'burn_imbalance',
            args: [
                {
                    type: 'uint64',
                    name: 'a_amt'
                },
                {
                    type: 'uint64',
                    name: 'b_amt'
                },
                {
                    type: 'uint64',
                    name: 'max_burn_amt'
                },
                {
                    type: 'axfer',
                    name: 'txn'
                }
            ],
            returns: {
                type: 'void'
            }
        },
        {
            name: 'swap',
            args: [
                {
                    type: 'axfer',
                    name: 'txn'
                },
                {
                    type: 'uint64',
                    name: 'min_swap_amt'
                }
            ],
            returns: {
                type: 'uint64'
            }
        },
        {
            name: 'redeem',
            args: [
                {
                    type: 'uint64',
                    name: 'amount'
                }
            ],
            returns: {
                type: 'void'
            }
        }
    ],
    networks: {}
};
