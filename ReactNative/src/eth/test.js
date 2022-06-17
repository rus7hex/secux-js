const { SecuxETH } = require("@secux/app-eth");
const { assert } = require("chai");
const { mnemonicToSeedSync } = require("bip39");
const { hdkey } = require("ethereumjs-wallet");
const { Transaction, FeeMarketEIP1559Transaction } = require("@ethereumjs/tx");
const Common = require("@ethereumjs/common").default;
const Web3 = require("web3");
const { BigNumber } = require('bignumber.js');
const { validate } = require("multicoin-address-validator");


const mnemonic = "neither black arm fun match nominee north lock cave judge window juice humor list verify permit unfold unfair expect muscle human true spoil ancient";
const seed = mnemonicToSeedSync(mnemonic);
const wallet = hdkey.fromMasterSeed(seed);


const BROADCAST = false;
export function test(GetDevice) {
    describe('SecuxETH.getAddress()', () => {
        const path = `m/44'/60'/${RandomInt(20)}'/0/${RandomInt(20)}`;

        let expected;
        before(() => {
            expected = wallet.derivePath(path).getWallet().getChecksumAddressString();
        });

        let address;
        it('query a EIP55 address', async () => {
            const buf = SecuxETH.prepareAddress(path);
            const rsp = await GetDevice().Exchange(buf);
            address = SecuxETH.resolveAddress(rsp);

            assert.equal(address, expected);
        });

        it('can directly call', async () => {
            const addr = await GetDevice().getAddress(path);

            assert.equal(addr, address);
        });

        it("is valid address", () => {
            const valid = validate(address, "ETH");

            assert.equal(valid, true);
            assert.equal(address.startsWith("0x"), true);
        });
    });

    describe('SecuxETH.signTransaction()', () => {
        describe('Legacy transaction', () => {
            const path = `m/44'/60'/${RandomInt(20)}'/0/${RandomInt(20)}`;
            const txParams = {
                nonce: RandomNumber(1e3),
                gasPrice: RandomNumber(1e8),
                gasLimit: RandomNumber(1e8),
                to: '0x123456789abc9876543210fedcba777777666666',
                value: RandomNumber(1e30),
                chainId: 137
            };

            let expected;
            before(() => {
                const common = Common.forCustomChain("mainnet", { chainId: txParams.chainId });
                const tx = Transaction.fromTxData(txParams, { common });
                const prv = wallet.derivePath(path).getWallet().getPrivateKey();
                expected = tx.sign(prv).serialize().toString('hex');
            });

            let signed;
            it('can create signed transaction', async () => {
                const { commandData, rawTx } = SecuxETH.prepareSignEIP155(path, txParams);
                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxETH.resolveTransaction(rsp, rawTx);

                assert.exists(signed);
            }).timeout(10000);

            it('can directly sign', async () => {
                const { raw_tx, signature } = await GetDevice().sign(path, txParams);

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it('verify raw data of signed transaction', async () => {
                VerifyRawData(signed.slice(2), expected, txParams);
            });
        });

        describe('EIP-1559 transaction', () => {
            const path = `m/44'/60'/${RandomInt(20)}'/0/${RandomInt(20)}`;
            const txParams = {
                nonce: RandomNumber(1e3),
                maxPriorityFeePerGas: RandomNumber(1e5),
                maxFeePerGas: RandomNumber(1e7),
                gasLimit: RandomNumber(1e5),
                to: '0x123456789abc9876543210fedcba777777666666',
                value: RandomNumber(1e30),
                chainId: 137
            };

            let expected;
            before(() => {
                const tx = FeeMarketEIP1559Transaction.fromTxData(txParams);
                const prv = wallet.derivePath(path).getWallet().getPrivateKey();
                expected = tx.sign(prv).serialize().toString('hex');
            });

            let signed;
            it('can create signed transaction', async () => {
                const { commandData, rawTx } = SecuxETH.prepareSignEIP1559(path, txParams);
                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxETH.resolveTransaction(rsp, rawTx);

                assert.exists(signed);
            }).timeout(10000);

            it('can directly sign', async () => {
                const { raw_tx, signature } = await GetDevice().sign(path, txParams);

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it('verify raw data of signed transaction', async () => {
                VerifyRawData1559(signed.slice(2), expected, txParams);
            });
        });

        describe('ERC20 transaction', () => {
            const contract = JSON.parse(require("./Binance.json").result);
            const web3 = new Web3();
            const erc20 = new web3.eth.Contract(contract);
            const path = `m/44'/60'/${RandomInt(20)}'/0/${RandomInt(20)}`;
            const txParams = {
                nonce: RandomNumber(1e3),
                gasPrice: RandomNumber(1e8),
                gasLimit: RandomNumber(1e8),
                to: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52',
                value: 0,
                chainId: 1
            };

            describe("transfer(to, value)", () => {
                const abiData = {
                    toAddress: "0x123456789abc9876543210fedcba777777666666",
                    amount: `0x${RandomInt(1e20).toString(16)}`
                };

                let signed;
                it("can create signed transaction", async () => {
                    const { commandData, rawTx } = SecuxETH.ERC20.prepareTransfer(path, txParams, abiData);
                    const rsp = await GetDevice().Exchange(commandData);
                    signed = SecuxETH.resolveTransaction(rsp, rawTx);

                    // const { commandData, rawTx } = SecuxETH.prepareSignEIP155(path, {
                    //     ...txParams,
                    //     data: abiEncoded
                    // });
                    // const rsp = await GetDevice().Exchange(commandData);
                    // signed = SecuxETH.resolveTransaction(rsp, rawTx);

                    assert.exists(signed);
                }).timeout(10000);

                it('verify raw data of signed transaction', async () => {
                    const abiEncoded = erc20.methods.transfer(abiData.toAddress, abiData.amount).encodeABI();
                    let params = Object.assign({}, txParams);
                    params.data = abiEncoded;

                    const tx = Transaction.fromTxData(params);
                    const prv = wallet.derivePath(path).getWallet().getPrivateKey();
                    const expected = tx.sign(prv).serialize().toString("hex");

                    VerifyRawData(signed.slice(2), expected, txParams);
                });
            });

            describe("transferFrom(from, to, value)", () => {
                const abiData = {
                    toAddress: "0x123456789abc9876543210fedcba777777666666",
                    amount: `0x${RandomInt(1e20).toString(16)}`
                };

                let signed;
                it("can create signed transaction", async () => {
                    let buf = SecuxETH.prepareAddress(path);
                    let rsp = await GetDevice().Exchange(buf);
                    const fromAddress = SecuxETH.resolveAddress(rsp);

                    const { commandData, rawTx } = SecuxETH.ERC20.prepareTransferFrom(path, txParams, { ...abiData, fromAddress });
                    rsp = await GetDevice().Exchange(commandData);
                    signed = SecuxETH.resolveTransaction(rsp, rawTx);

                    assert.exists(signed);
                }).timeout(10000);

                it('verify raw data of signed transaction', async () => {
                    const from = wallet.derivePath(path).getWallet().getChecksumAddressString();
                    const abiEncoded = erc20.methods.transferFrom(from, abiData.toAddress, abiData.amount).encodeABI();
                    let params = Object.assign({}, txParams);
                    params.data = abiEncoded;

                    const tx = Transaction.fromTxData(params);
                    const prv = wallet.derivePath(path).getWallet().getPrivateKey();
                    const expected = tx.sign(prv).serialize().toString("hex");

                    VerifyRawData(signed.slice(2), expected, txParams);
                });
            });
        });

        describe('ERC721 transaction', () => {
            const contract = JSON.parse(require("./BraveSeries.json").result);
            const web3 = new Web3();
            const erc721 = new web3.eth.Contract(contract);
            const path = `m/44'/60'/${RandomInt(20)}'/0/${RandomInt(20)}`;
            const txParams = {
                nonce: RandomNumber(1e3),
                maxPriorityFeePerGas: RandomNumber(1e5),
                maxFeePerGas: RandomNumber(1e7),
                gasLimit: RandomNumber(1e5),
                to: '0x55eCd70df7b4369b0FD82cE841B3ba8037C034EC',
                value: 0,
                chainId: 1
            };

            describe("transferFrom(from, to, tokenId)", () => {
                const abiData = {
                    toAddress: "0x123456789abc9876543210fedcba777777666666",
                    tokenId: `0x${RandomInt(1e20).toString(16)}`
                };

                let signed;
                it("can create signed transaction", async () => {
                    let buf = SecuxETH.prepareAddress(path);
                    let rsp = await GetDevice().Exchange(buf);
                    const fromAddress = SecuxETH.resolveAddress(rsp);

                    const { commandData, rawTx } = SecuxETH.ERC721.prepareTransferFrom(path, txParams, { ...abiData, fromAddress });
                    rsp = await GetDevice().Exchange(commandData);
                    signed = SecuxETH.resolveTransaction(rsp, rawTx);

                    assert.exists(signed);
                }).timeout(10000);

                it('verify raw data of signed transaction', async () => {
                    const from = wallet.derivePath(path).getWallet().getChecksumAddressString();
                    const abiEncoded = erc721.methods.transferFrom(from, abiData.toAddress, abiData.tokenId).encodeABI();
                    let params = Object.assign({}, txParams);
                    params.data = abiEncoded;

                    const tx = FeeMarketEIP1559Transaction.fromTxData(params);
                    const prv = wallet.derivePath(path).getWallet().getPrivateKey();
                    const expected = tx.sign(prv).serialize().toString("hex");

                    VerifyRawData1559(signed.slice(2), expected, txParams);
                });
            });

            describe("safeTransferFrom(from, to, tokenId)", () => {
                const abiData = {
                    toAddress: "0x123456789abc9876543210fedcba777777666666",
                    tokenId: `0x${RandomInt(1e20).toString(16)}`
                };

                let signed;
                it("can create signed transaction", async () => {
                    let buf = SecuxETH.prepareAddress(path);
                    let rsp = await GetDevice().Exchange(buf);
                    const fromAddress = SecuxETH.resolveAddress(rsp);

                    const { commandData, rawTx } = SecuxETH.ERC721.prepareSafeTransferFrom(path, txParams, { ...abiData, fromAddress });
                    rsp = await GetDevice().Exchange(commandData);
                    signed = SecuxETH.resolveTransaction(rsp, rawTx);

                    assert.exists(signed);
                }).timeout(10000);

                it('verify raw data of signed transaction', async () => {
                    const from = wallet.derivePath(path).getWallet().getChecksumAddressString();
                    const abiEncoded = erc721.methods.safeTransferFrom(from, abiData.toAddress, abiData.tokenId).encodeABI();
                    let params = Object.assign({}, txParams);
                    params.data = abiEncoded;

                    const tx = FeeMarketEIP1559Transaction.fromTxData(params);
                    const prv = wallet.derivePath(path).getWallet().getPrivateKey();
                    const expected = tx.sign(prv).serialize().toString("hex");

                    VerifyRawData1559(signed.slice(2), expected, txParams);
                });
            });

            describe("safeTransferFrom(from, to, tokenId, data)", () => {
                const abiData = {
                    toAddress: "0x123456789abc9876543210fedcba777777666666",
                    tokenId: `0x${RandomInt(1e20).toString(16)}`,
                    data: Buffer.from("secux")
                };

                let signed;
                it("can create signed transaction", async () => {
                    let buf = SecuxETH.prepareAddress(path);
                    let rsp = await GetDevice().Exchange(buf);
                    const fromAddress = SecuxETH.resolveAddress(rsp);

                    const { commandData, rawTx } = SecuxETH.ERC721.prepareSafeTransferFrom(path, txParams, { ...abiData, fromAddress });
                    rsp = await GetDevice().Exchange(commandData);
                    signed = SecuxETH.resolveTransaction(rsp, rawTx);

                    assert.exists(signed);
                }).timeout(10000);

                it('verify raw data of signed transaction', async () => {
                    const from = wallet.derivePath(path).getWallet().getChecksumAddressString();
                    const abiEncoded = erc721.methods.safeTransferFrom(from, abiData.toAddress, abiData.tokenId, abiData.data).encodeABI();
                    let params = Object.assign({}, txParams);
                    params.data = abiEncoded;

                    const tx = FeeMarketEIP1559Transaction.fromTxData(params);
                    const prv = wallet.derivePath(path).getWallet().getPrivateKey();
                    const expected = tx.sign(prv).serialize().toString("hex");

                    VerifyRawData1559(signed.slice(2), expected, txParams);
                });
            });

            describe("approve(to, tokenId)", () => {
                const abiData = {
                    toAddress: "0x123456789abc9876543210fedcba777777666666",
                    tokenId: `0x${RandomInt(1e20).toString(16)}`
                };

                let signed;
                it("can create signed transaction", async () => {
                    const { commandData, rawTx } = SecuxETH.ERC721.prepareApprove(path, txParams, abiData);
                    const rsp = await GetDevice().Exchange(commandData);
                    signed = SecuxETH.resolveTransaction(rsp, rawTx);

                    assert.exists(signed);
                }).timeout(10000);

                it('verify raw data of signed transaction', async () => {
                    const from = wallet.derivePath(path).getWallet().getChecksumAddressString();
                    const abiEncoded = erc721.methods.approve(abiData.toAddress, abiData.tokenId).encodeABI();
                    let params = Object.assign({}, txParams);
                    params.data = abiEncoded;

                    const tx = FeeMarketEIP1559Transaction.fromTxData(params);
                    const prv = wallet.derivePath(path).getWallet().getPrivateKey();
                    const expected = tx.sign(prv).serialize().toString("hex");

                    VerifyRawData1559(signed.slice(2), expected, txParams);
                });
            });
        });

        describe('ERC1155 transaction', () => {
            const contract = require("./ERC1155.json");
            const web3 = new Web3();
            const erc1155 = new web3.eth.Contract(contract);
            const path = `m/44'/60'/${RandomInt(20)}'/0/${RandomInt(20)}`;
            const txParams = {
                nonce: RandomNumber(1e3),
                maxPriorityFeePerGas: RandomNumber(1e5),
                maxFeePerGas: RandomNumber(1e7),
                gasLimit: RandomNumber(1e5),
                to: '0x55eCd70df7b4369b0FD82cE841B3ba8037C034EC',
                value: 0,
                chainId: 1
            };

            describe("safeTransferFrom(from, to, id, value, data)", () => {
                const abiData = {
                    toAddress: "0x123456789abc9876543210fedcba777777666666",
                    id: `0x${RandomInt(1e20).toString(16)}`,
                    value: `0x${RandomInt(1e20).toString(16)}`,
                    data: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
                };

                let signed;
                it("can create signed transaction", async () => {
                    let buf = SecuxETH.prepareAddress(path);
                    let rsp = await GetDevice().Exchange(buf);
                    const fromAddress = SecuxETH.resolveAddress(rsp);

                    const { commandData, rawTx } = SecuxETH.ERC1155.prepareSafeTransferFrom(path, txParams, { ...abiData, fromAddress });
                    rsp = await GetDevice().Exchange(commandData);
                    signed = SecuxETH.resolveTransaction(rsp, rawTx);

                    assert.exists(signed);
                }).timeout(10000);

                it('verify raw data of signed transaction', async () => {
                    const from = wallet.derivePath(path).getWallet().getChecksumAddressString();
                    const abiEncoded = erc1155.methods.safeTransferFrom(from, abiData.toAddress, abiData.id, abiData.value, abiData.data).encodeABI();
                    let params = Object.assign({}, txParams);
                    params.data = abiEncoded;

                    const tx = FeeMarketEIP1559Transaction.fromTxData(params);
                    const prv = wallet.derivePath(path).getWallet().getPrivateKey();
                    const expected = tx.sign(prv).serialize().toString("hex");

                    VerifyRawData1559(signed.slice(2), expected, txParams);
                });
            });

            describe("safeBatchTransferFrom(from, to, ids, values, data)", () => {
                const abiData = {
                    toAddress: "0x123456789abc9876543210fedcba777777666666",
                    items: [
                        {
                            id: `0x${RandomInt(1e11).toString(16)}`,
                            value: `0x${RandomInt(1e20).toString(16)}`
                        },
                        {
                            id: `0x${RandomInt(1e20).toString(16)}`,
                            value: `0x${RandomInt(1e11).toString(16)}`
                        },
                    ]
                };

                let signed;
                it("can create signed transaction", async () => {
                    let buf = SecuxETH.prepareAddress(path);
                    let rsp = await GetDevice().Exchange(buf);
                    const fromAddress = SecuxETH.resolveAddress(rsp);

                    const { commandData, rawTx } = SecuxETH.ERC1155.prepareSafeBatchTransferFrom(path, txParams, { ...abiData, fromAddress });
                    rsp = await GetDevice().Exchange(commandData);
                    signed = SecuxETH.resolveTransaction(rsp, rawTx);

                    assert.exists(signed);
                }).timeout(10000);

                it('verify raw data of signed transaction', async () => {
                    const from = wallet.derivePath(path).getWallet().getChecksumAddressString();
                    const abiEncoded = erc1155.methods.safeBatchTransferFrom(
                        from,
                        abiData.toAddress,
                        abiData.items.map(x => x.id),
                        abiData.items.map(x => x.value),
                        "0x"
                    ).encodeABI();
                    let params = Object.assign({}, txParams);
                    params.data = abiEncoded;

                    const tx = FeeMarketEIP1559Transaction.fromTxData(params);
                    const prv = wallet.derivePath(path).getWallet().getPrivateKey();
                    const expected = tx.sign(prv).serialize().toString("hex");

                    VerifyRawData1559(signed.slice(2), expected, txParams);
                });

                it("should fail to sign with duplicate id", () => {
                    let failed = false;
                    try {
                        const { commandData, rawTx } = SecuxETH.ERC1155.prepareSafeBatchTransferFrom(path, txParams, {
                            toAddress: abiData.toAddress,
                            fromAddress: "0x123456789abc9876543210fedcba777777888888",
                            items: [
                                {
                                    id: `0x1234`,
                                    value: `0x${RandomInt(1e20).toString(16)}`
                                },
                                {
                                    id: `0x1234`,
                                    value: `0x${RandomInt(1e20).toString(16)}`
                                },
                                {
                                    id: `0x${RandomInt(1e20).toString(16)}`,
                                    value: `0x${RandomInt(1e11).toString(16)}`
                                },
                            ]
                        });
                    } catch (error) { failed = true; console.log(error); }

                    if (!failed) assert.fail();
                });
            });
        });
    });

    describe('SecuxETH.signMessage()', () => {
        const path = `m/44'/60'/${RandomInt(20)}'/0/${RandomInt(20)}`;
        const Message = "Hi, welcomee to SecuX!";

        let signature;
        it('can sign message', async () => {
            const buf = SecuxETH.prepareSignMessage(path, Message);
            const rsp = await GetDevice().Exchange(buf);
            signature = Buffer.from(SecuxETH.resolveSignatureEIP155(rsp), "hex");

            assert.equal(signature.length, 65);
            assert.include([27, 28], signature.readUInt8(64));
        }).timeout(10000);

        it('can directly sign', async () => {
            const { raw_tx, signature: sig } = await GetDevice().sign(path, Message);

            assert.equal(sig, `0x${signature.toString("hex")}`);
        }).timeout(10000);
    });

    describe('SecuxETH.signTypedData()', () => {
        const path = "m/44'/60'/0'/0/0";
        let jsonMessage = '{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"verifyingContract","type":"address"}],"RelayRequest":[{"name":"target","type":"address"},{"name":"encodedFunction","type":"bytes"},{"name":"gasData","type":"GasData"},{"name":"relayData","type":"RelayData"}],"GasData":[{"name":"gasLimit","type":"uint256"},{"name":"gasPrice","type":"uint256"},{"name":"pctRelayFee","type":"uint256"},{"name":"baseRelayFee","type":"uint256"}],"RelayData":[{"name":"senderAddress","type":"address"},{"name":"senderNonce","type":"uint256"},{"name":"relayWorker","type":"address"},{"name":"paymaster","type":"address"}]},"domain":{"name":"GSN Relayed Transaction","version":"1","chainId":42,"verifyingContract":"0x6453D37248Ab2C16eBd1A8f782a2CBC65860E60B"},"primaryType":"RelayRequest","message":{"target":"0x9cf40ef3d1622efe270fe6fe720585b4be4eeeff","encodedFunction":"0xa9059cbb0000000000000000000000002e0d94754b348d208d64d52d78bcd443afa9fa520000000000000000000000000000000000000000000000000000000000000007","gasData":{"gasLimit":"39507","gasPrice":"1700000000","pctRelayFee":"70","baseRelayFee":"0"},"relayData":{"senderAddress":"0x22d491bde2303f2f43325b2108d26f1eaba1e32b","senderNonce":"3","relayWorker":"0x3baee457ad824c94bd3953183d725847d023a2cf","paymaster":"0x957F270d45e9Ceca5c5af2b49f1b5dC1Abb0421c"}}}';

        let signature;
        it('can sign typed data', async () => {
            const buf = SecuxETH.prepareSignTypedData(path, jsonMessage);
            const rsp = await GetDevice().Exchange(buf);
            signature = Buffer.from(SecuxETH.resolveSignatureEIP155(rsp), "hex");

            assert.equal(signature.length, 65);
            assert.include([27, 28], signature.readUInt8(64));
            assert.equal(signature.toString("hex"), "0e79a896bdd1372dbab1080c3f903fb6223150df328db83f5b4fd28f117e74b27db829ec78d98a11d42725eb9ed36e6fdbc6a2922472cf821e439213cc35e8d41c");
        }).timeout(10000);

        it('can directly sign', async () => {
            const { raw_tx, signature: sig } = await GetDevice().sign(path, jsonMessage);

            assert.equal(sig, `0x${signature.toString("hex")}`);
        }).timeout(10000);
    });

    describe('SecuxETH.signWalletConnectTransaction()', () => {
        const path = `m/44'/60'/${RandomInt(20)}'/0/${RandomInt(20)}`;
        const txParams = {
            nonce: RandomNumber(1e3),
            gasPrice: RandomNumber(1e8),
            gasLimit: RandomNumber(1e8),
            to: '0xD080156885651fADbD6df14145051b934660a748',
            value: RandomNumber(1e30),
            data: '0x7ff36ab5000000000000000000000000000000000000000000000000302bf3f82d406d120000000000000000000000000000000000000000000000000000000000000080000000000000000000000000d080156885651fadbd6df14145051b934660a7480000000000000000000000000000000000000000000000000000000060b613630000000000000000000000000000000000000000000000000000000000000003000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c0000000000000000000000007130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c000000000000000000000000e9e7cea3dedca5984780bafc599bd69add087d56',
            chainId: 56
        };

        let signed;
        it('can sign with WallectConnect protocol', async () => {
            const { commandData, rawTx } = SecuxETH.prepareSignWalletConnectTransaction(path, txParams);
            const rsp = await GetDevice().Exchange(commandData);
            signed = SecuxETH.resolveTransaction(rsp, rawTx);

            assert.exists(signed);
        }).timeout(10000);

        it('can directly sign', async () => {
            const { raw_tx, signature } = await GetDevice().sign(path, txParams, true);

            assert.equal(raw_tx, signed);
        }).timeout(10000);
    });

    if (BROADCAST) {
        describe("Test with broadcast", () => {
            const path_from = "m/44'/60'/0'/0/0";
            const path_to = `m/44'/60'/2'/0/0`;
            const web3 = new Web3(new Web3.providers.WebsocketProvider("wss://mainnet.infura.io/ws/v3/a4219248696e4ddc9de15e1cd10c88f1"));


            it("ETH1 to ETH3", async () => {
                const device = GetDevice();
                const from = await SecuxETH.getAddress(device, path_from);
                const to = await SecuxETH.getAddress(device, path_to);
                const fees = (await web3.eth.getFeeHistory(1, "latest")).baseFeePerGas.map(x => parseInt(x.slice(2), 16));
                const baseFee = Math.floor(fees.reduce((a, b) => a + b, 0) / fees.length);
                const block = await web3.eth.getBlock("latest");
                const gasLimit = 25000; //Math.floor(block.gasUsed / block.transactions.length);
                const balance = new BigNumber(await web3.eth.getBalance(from));
                const nonce = await web3.eth.getTransactionCount(from);


                const buf = SecuxETH.prepareSign(path_from, {
                    nonce,
                    to,
                    value: `0x${1e15.toString(16)}`,
                    chainId: 1,
                    maxPriorityFeePerGas: 1,
                    maxFeePerGas: 2 * baseFee + 1,
                    gasLimit
                });
                const rsp = await device.Exchange(buf);
                const raw_tx = SecuxETH.resolve(rsp);

                web3.eth.sendSignedTransaction(raw_tx, (e, hash) => {
                    if (e) console.log(e);
                    else {
                        console.log(hash);
                    }
                });
            }).timeout(60000);
        });
    }
}


function RandomNumber(max) {
    const value = (new BigNumber(Math.random())).times(max).integerValue();
    return `0x${value.toString(16)}`;
}

function RandomInt(max) {
    const value = Math.floor(Math.random() * max);
    return value.toString();
}

function VerifyRawData(actual, expect, content) {
    const act = Transaction.fromSerializedTx(Buffer.from(actual, "hex"));
    const exp = Transaction.fromSerializedTx(Buffer.from(expect, "hex"));

    assert.equal(act.nonce.toNumber(), content.nonce, "[nonce]");
    assert.equal(act.gasPrice.toNumber(), content.gasPrice, "[gasPrice]");
    assert.equal(act.gasLimit.toNumber(), content.gasLimit, "[gasLimit]");
    assert.equal(act.to.toString(), content.to.toLowerCase(), "[to]");
    assert.equal(`0x${act.value.toString("hex")}`, content.value, "[value]");
    assert.equal(act.common.chainIdBN().toNumber(), content.chainId, "[chainId]");
    assert.equal(act.data.toString("hex"), exp.data.toString("hex"));
    assert.equal(act.r.toString(), exp.r.toString(), "[signature r]");
    assert.equal(act.s.toString(), exp.s.toString(), "[signature s]");
    assert.equal(act.v.toString(), exp.v.toString(), "[signature v]");
    assert.equal(actual, expect, "[raw transaction]");
}

function VerifyRawData1559(actual, expect, content) {
    const act = FeeMarketEIP1559Transaction.fromSerializedTx(Buffer.from(actual, "hex"));
    const exp = FeeMarketEIP1559Transaction.fromSerializedTx(Buffer.from(expect, "hex"));

    assert.equal(act.nonce.toNumber(), content.nonce, "[nonce]");
    assert.equal(act.maxPriorityFeePerGas.toNumber(), content.maxPriorityFeePerGas, "[maxPriorityFeePerGas]");
    assert.equal(act.maxFeePerGas.toNumber(), content.maxFeePerGas, "[maxFeePerGas]");
    assert.equal(act.gasLimit.toNumber(), content.gasLimit, "[gasLimit]");
    assert.equal(act.to.toString(), content.to.toLowerCase(), "[to]");
    assert.equal(`0x${act.value.toString("hex")}`, content.value, "[value]");
    assert.equal(act.common.chainIdBN().toNumber(), content.chainId, "[chainId]");
    assert.equal(act.data.toString("hex"), exp.data.toString("hex"));
    assert.equal(act.r.toString(), exp.r.toString(), "[signature r]");
    assert.equal(act.s.toString(), exp.s.toString(), "[signature s]");
    assert.equal(act.v.toString(), exp.v.toString(), "[signature v]");
    assert.equal(actual, expect, "[raw transaction]");
}