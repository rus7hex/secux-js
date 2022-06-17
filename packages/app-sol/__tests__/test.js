const { SecuxSOL } = require("@secux/app-sol");
const { assert } = require("chai");
const { mnemonicToSeedSync } = require("bip39");
const { derivePath } = require("ed25519-hd-key");
const solanaWeb3 = require("@solana/web3.js");
const spl = require("@solana/spl-token");
const { validate } = require("multicoin-address-validator");


const mnemonic = "neither black arm fun match nominee north lock cave judge window juice humor list verify permit unfold unfair expect muscle human true spoil ancient";
const seed = mnemonicToSeedSync(mnemonic);


const BROADCAST = false;
const AIRDROP = false;
export function test(GetDevice) {
    describe('SecuxSOL.getAddress()', () => {
        describe("main account", () => {
            const path = `m/44'/501'/${RandomNumber(20)}'`;
            const { key } = derivePath(path, seed.toString("hex"));
            const expected = solanaWeb3.Keypair.fromSeed(key).publicKey.toString();

            let address;
            it('query a SOL address', async () => {
                const data = SecuxSOL.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxSOL.resolveAddress(rsp);

                assert.equal(address, expected);
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path);
                assert.equal(addr, address);
            });

            it("is valid address", () => {
                const valid = validate(address, "SOL");
                assert.equal(valid, true);
            });
        });

        describe("associated token account", () => {
            const path = `m/44'/501'/${RandomNumber(20)}'`;
            const mintAccount = solanaWeb3.Keypair.generate().publicKey;
            const { key } = derivePath(path, seed.toString("hex"));
            const account = solanaWeb3.Keypair.fromSeed(key).publicKey;

            let address;
            it('query a SOL token address', async () => {
                const data = SecuxSOL.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxSOL.resolveAddress(rsp, { mintAccount: mintAccount.toString() });
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path, { mintAccount: mintAccount.toString() });
                assert.equal(addr, address);
            });

            it("is valid address", async () => {
                const valid = validate(address, "SOL");
                assert.equal(valid, true);

                const expected = await spl.getAssociatedTokenAddress(mintAccount, account);
                assert.equal(address, expected);
            });
        });

        describe("account with seed", () => {
            const path = `m/44'/501'/${RandomNumber(20)}'`;
            const { key } = derivePath(path, seed.toString("hex"));
            const account = solanaWeb3.Keypair.fromSeed(key).publicKey;
            const programId = solanaWeb3.Keypair.generate().publicKey;
            const seedStr = randomString(20);

            let address;
            it('query a SOL address with seed', async () => {
                const data = SecuxSOL.prepareAddress(path);
                const rsp = await GetDevice().Exchange(data);
                address = SecuxSOL.resolveAddress(rsp, { seed: seedStr, programId: programId.toString() });
            });

            it("can directly call", async () => {
                const addr = await GetDevice().getAddress(path, { seed: seedStr, programId: programId.toString() });
                assert.equal(addr, address);
            });

            it("is valid address", async () => {
                const valid = validate(address, "SOL");
                assert.equal(valid, true);

                const expected = await solanaWeb3.PublicKey.createWithSeed(account, seedStr, programId);
                assert.equal(address, expected.toString());
            });
        });
    });

    describe("SecuxSOL.signTransaction()", () => {
        describe("transfer", () => {
            const path_from = `m/44'/501'/${RandomNumber(20)}'`;
            const path_to = `m/44'/501'/${RandomNumber(20)}'`;
            const key_from = derivePath(path_from, seed.toString("hex")).key;
            const key_to = derivePath(path_to, seed.toString("hex")).key;
            const from = solanaWeb3.Keypair.fromSeed(key_from).publicKey;
            const to = solanaWeb3.Keypair.fromSeed(key_to).publicKey;
            const amount = Math.ceil(Math.random() * 1e9);
            const recentBlockhash = solanaWeb3.Keypair.generate().publicKey.toString();

            let signed
            it("can create and sign transaction", async () => {
                const transfer = solanaWeb3.SystemProgram.transfer({
                    fromPubkey: from,
                    toPubkey: to,
                    lamports: amount
                });

                const accounts = transfer.keys.map(x => ({
                    ...x,
                    publickey: x.pubkey.toBuffer()
                }));

                const { commandData, serialized } = SecuxSOL.prepareSign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            programId: transfer.programId.toString(),
                            accounts,
                            data: transfer.data
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxSOL.resolveTransaction(rsp, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly sign", async () => {
                const { raw_tx } = await GetDevice().sign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "transfer",
                            params: {
                                from: from.toString(),
                                to: to.toString(),
                                lamports: amount,
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const tx = solanaWeb3.Transaction.from(Buffer.from(signed, "hex"));
                assert.equal(tx.recentBlockhash, recentBlockhash, "recentBlockhash");
                assert.equal(tx.feePayer.toString(), from.toString(), "feePayer");

                const transfer = solanaWeb3.SystemInstruction.decodeTransfer(tx.instructions[0]);
                assert.equal(transfer.fromPubkey.toString(), from.toString(), "from");
                assert.equal(transfer.toPubkey.toString(), to.toString(), "to");
                assert.equal(transfer.lamports, amount, "lamports");
            });
        });

        describe("create associated token account", () => {
            const path_from = `m/44'/501'/${RandomNumber(20)}'`;
            const key_from = derivePath(path_from, seed.toString("hex")).key;
            const from = solanaWeb3.Keypair.fromSeed(key_from).publicKey;
            const mint = solanaWeb3.Keypair.generate().publicKey;
            const recentBlockhash = solanaWeb3.Keypair.generate().publicKey.toString();

            let signed
            it("can create and sign transaction", async () => {
                const { commandData, serialized } = SecuxSOL.prepareSign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "createAssociatedTokenAccount",
                            params: {
                                payer: from.toString(),
                                owner: from.toString(),
                                mint: mint.toString()
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxSOL.resolveTransaction(rsp, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly sign", async () => {
                const { raw_tx } = await GetDevice().sign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "createAssociatedTokenAccount",
                            params: {
                                payer: from.toString(),
                                owner: from.toString(),
                                mint: mint.toString()
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const tx = solanaWeb3.Transaction.from(Buffer.from(signed, "hex"));
                assert.equal(tx.recentBlockhash, recentBlockhash, "recentBlockhash");
                assert.equal(tx.feePayer.toString(), from.toString(), "feePayer");

                const instruction = spl.createAssociatedTokenAccountInstruction(
                    from,
                    await spl.getAssociatedTokenAddress(mint, from),
                    from,
                    mint
                );
                assert.equal(tx.instructions[0].programId.toString(), instruction.programId.toString(), "programId");
                assert.equal(tx.instructions[0].data.toString("hex"), instruction.data.toString("hex"), "data");
                for (let i = 0; i < instruction.keys.length; i++) {
                    const actual = tx.instructions[0].keys[i];
                    const expect = instruction.keys[i];
                    assert.equal(actual.pubkey.toString(), expect.pubkey.toString(), `pubkey#${i}`);
                }
            });
        });

        describe("transfer token", () => {
            const path_from = `m/44'/501'/${RandomNumber(20)}'`;
            const key_from = derivePath(path_from, seed.toString("hex")).key;
            const from = solanaWeb3.Keypair.fromSeed(key_from).publicKey;
            const amount = Math.ceil(Math.random() * 1e19).toString();
            const recentBlockhash = solanaWeb3.Keypair.generate().publicKey.toString();
            const src = solanaWeb3.Keypair.generate().publicKey;
            const dst = solanaWeb3.Keypair.generate().publicKey;

            let signed
            it("can create and sign transaction", async () => {
                const { commandData, serialized } = SecuxSOL.prepareSign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "tokenTransfer",
                            params: {
                                from: src.toString(),
                                to: dst.toString(),
                                owner: from.toString(),
                                amount
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxSOL.resolveTransaction(rsp, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly sign", async () => {
                const { raw_tx } = await GetDevice().sign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "tokenTransfer",
                            params: {
                                from: src.toString(),
                                to: dst.toString(),
                                owner: from.toString(),
                                amount
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const tx = solanaWeb3.Transaction.from(Buffer.from(signed, "hex"));
                assert.equal(tx.recentBlockhash, recentBlockhash, "recentBlockhash");
                assert.equal(tx.feePayer.toString(), from.toString(), "feePayer");

                const instruction = spl.createTransferInstruction(
                    src,
                    dst,
                    from,
                    BigInt(amount)
                );
                assert.equal(tx.instructions[0].programId.toString(), instruction.programId.toString(), "programId");
                assert.equal(tx.instructions[0].data.toString("hex"), instruction.data.toString("hex"), "data");
                for (let i = 0; i < instruction.keys.length; i++) {
                    const actual = tx.instructions[0].keys[i];
                    const expect = instruction.keys[i];
                    assert.equal(actual.pubkey.toString(), expect.pubkey.toString(), `pubkey#${i}`);
                }
            });
        });

        describe("transfer token (checked)", () => {
            const path_from = `m/44'/501'/${RandomNumber(20)}'`;
            const key_from = derivePath(path_from, seed.toString("hex")).key;
            const from = solanaWeb3.Keypair.fromSeed(key_from).publicKey;
            const amount = Math.ceil(Math.random() * 1e19).toString();
            const recentBlockhash = solanaWeb3.Keypair.generate().publicKey.toString();
            const src = solanaWeb3.Keypair.generate().publicKey;
            const dst = solanaWeb3.Keypair.generate().publicKey;
            const mint = solanaWeb3.Keypair.generate().publicKey;
            const decimal = Math.ceil(Math.random() * 10);

            let signed
            it("can create and sign transaction", async () => {
                const { commandData, serialized } = SecuxSOL.prepareSign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "tokenTransferChecked",
                            params: {
                                from: src.toString(),
                                to: dst.toString(),
                                owner: from.toString(),
                                mint: mint.toString(),
                                decimal,
                                amount
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxSOL.resolveTransaction(rsp, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly sign", async () => {
                const { raw_tx } = await GetDevice().sign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "tokenTransferChecked",
                            params: {
                                from: src.toString(),
                                to: dst.toString(),
                                owner: from.toString(),
                                mint: mint.toString(),
                                decimal,
                                amount
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const tx = solanaWeb3.Transaction.from(Buffer.from(signed, "hex"));
                assert.equal(tx.recentBlockhash, recentBlockhash, "recentBlockhash");
                assert.equal(tx.feePayer.toString(), from.toString(), "feePayer");

                const instruction = spl.createTransferCheckedInstruction(
                    src,
                    mint,
                    dst,
                    from,
                    BigInt(amount),
                    decimal
                );
                assert.equal(tx.instructions[0].programId.toString(), instruction.programId.toString(), "programId");
                assert.equal(tx.instructions[0].data.toString("hex"), instruction.data.toString("hex"), "data");
                for (let i = 0; i < instruction.keys.length; i++) {
                    const actual = tx.instructions[0].keys[i];
                    const expect = instruction.keys[i];
                    assert.equal(actual.pubkey.toString(), expect.pubkey.toString(), `pubkey#${i}`);
                }
            });
        });

        describe("close account", () => {
            const path_from = `m/44'/501'/${RandomNumber(20)}'`;
            const key_from = derivePath(path_from, seed.toString("hex")).key;
            const from = solanaWeb3.Keypair.fromSeed(key_from).publicKey;
            const recentBlockhash = solanaWeb3.Keypair.generate().publicKey.toString();
            const account = solanaWeb3.Keypair.generate().publicKey;

            let signed
            it("can create and sign transaction", async () => {
                const { commandData, serialized } = SecuxSOL.prepareSign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "closeAccount",
                            params: {
                                account: account.toString(),
                                owner: from.toString()
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxSOL.resolveTransaction(rsp, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly sign", async () => {
                const { raw_tx } = await GetDevice().sign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "closeAccount",
                            params: {
                                account: account.toString(),
                                owner: from.toString()
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const tx = solanaWeb3.Transaction.from(Buffer.from(signed, "hex"));
                assert.equal(tx.recentBlockhash, recentBlockhash, "recentBlockhash");
                assert.equal(tx.feePayer.toString(), from.toString(), "feePayer");

                const instruction = spl.createCloseAccountInstruction(
                    account,
                    from,
                    from,
                );
                assert.equal(tx.instructions[0].programId.toString(), instruction.programId.toString(), "programId");
                assert.equal(tx.instructions[0].data.toString("hex"), instruction.data.toString("hex"), "data");
                for (let i = 0; i < instruction.keys.length; i++) {
                    const actual = tx.instructions[0].keys[i];
                    const expect = instruction.keys[i];
                    assert.equal(actual.pubkey.toString(), expect.pubkey.toString(), `pubkey#${i}`);
                }
            });
        });

        describe("create account with seed", () => {
            const path_from = `m/44'/501'/${RandomNumber(20)}'`;
            const key_from = derivePath(path_from, seed.toString("hex")).key;
            const payer = solanaWeb3.Keypair.fromSeed(key_from).publicKey;
            const from = solanaWeb3.Keypair.generate().publicKey;
            const recentBlockhash = solanaWeb3.Keypair.generate().publicKey.toString();
            const seedStr = randomString(10);
            const programId = solanaWeb3.Keypair.generate().publicKey;
            const lamports = 5 * 1e8;

            let signed
            it("can create and sign transaction", async () => {
                const { commandData, serialized } = SecuxSOL.prepareSign(payer.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "createAccountWithSeed",
                            params: {
                                payer: payer.toString(),
                                from: from.toString(),
                                seed: seedStr,
                                programId: programId.toString(),
                                lamports,
                                space: 200 // default
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: payer.toString() }
                    ]
                });

                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxSOL.resolveTransaction(rsp, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly sign", async () => {
                const { raw_tx } = await GetDevice().sign(payer.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "createAccountWithSeed",
                            params: {
                                payer: payer.toString(),
                                from: from.toString(),
                                seed: seedStr,
                                programId: programId.toString(),
                                lamports,
                                path: path_from,
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: payer.toString() }
                    ]
                });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const tx = solanaWeb3.Transaction.from(Buffer.from(signed, "hex"));
                assert.equal(tx.recentBlockhash, recentBlockhash, "recentBlockhash");
                assert.equal(tx.feePayer.toString(), payer.toString(), "feePayer");

                const instruction = solanaWeb3.SystemProgram.createAccountWithSeed({
                    fromPubkey: payer,
                    newAccountPubkey: await solanaWeb3.PublicKey.createWithSeed(from, seedStr, programId),
                    basePubkey: from,
                    seed: seedStr,
                    lamports,
                    space: 200,
                    programId
                });
                assert.equal(tx.instructions[0].programId.toString(), instruction.programId.toString(), "programId");
                assert.equal(tx.instructions[0].data.toString("hex"), instruction.data.toString("hex"), "data");
                for (let i = 0; i < instruction.keys.length; i++) {
                    const actual = tx.instructions[0].keys[i];
                    const expect = instruction.keys[i];
                    assert.equal(actual.pubkey.toString(), expect.pubkey.toString(), `pubkey#${i}`);
                }
            });
        });

        describe("initialize stake account", () => {
            const path_from = `m/44'/501'/${RandomNumber(20)}'`;
            const key_from = derivePath(path_from, seed.toString("hex")).key;
            const from = solanaWeb3.Keypair.fromSeed(key_from).publicKey;
            const recentBlockhash = solanaWeb3.Keypair.generate().publicKey.toString();
            const stake = solanaWeb3.Keypair.generate().publicKey;

            let signed
            it("can create and sign transaction", async () => {
                const { commandData, serialized } = SecuxSOL.prepareSign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "initializeStake",
                            params: {
                                owner: from.toString(),
                                stake: stake.toString()
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxSOL.resolveTransaction(rsp, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly sign", async () => {
                const { raw_tx } = await GetDevice().sign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "initializeStake",
                            params: {
                                owner: from.toString(),
                                stake: stake.toString()
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const tx = solanaWeb3.Transaction.from(Buffer.from(signed, "hex"));
                assert.equal(tx.recentBlockhash, recentBlockhash, "recentBlockhash");
                assert.equal(tx.feePayer.toString(), from.toString(), "feePayer");

                const instruction = solanaWeb3.StakeProgram.initialize({
                    stakePubkey: stake,
                    authorized: new solanaWeb3.Authorized(from, from),
                    lockup: new solanaWeb3.Lockup(0, 0, from)
                });
                assert.equal(tx.instructions[0].programId.toString(), instruction.programId.toString(), "programId");
                assert.equal(tx.instructions[0].data.toString("hex"), instruction.data.toString("hex"), "data");
                for (let i = 0; i < instruction.keys.length; i++) {
                    const actual = tx.instructions[0].keys[i];
                    const expect = instruction.keys[i];
                    assert.equal(actual.pubkey.toString(), expect.pubkey.toString(), `pubkey#${i}`);
                }
            });
        });

        describe("delegate stake", () => {
            const path_from = `m/44'/501'/${RandomNumber(20)}'`;
            const key_from = derivePath(path_from, seed.toString("hex")).key;
            const from = solanaWeb3.Keypair.fromSeed(key_from).publicKey;
            const recentBlockhash = solanaWeb3.Keypair.generate().publicKey.toString();
            const stake = solanaWeb3.Keypair.generate().publicKey;
            const vote = solanaWeb3.Keypair.generate().publicKey;

            let signed
            it("can create and sign transaction", async () => {
                const { commandData, serialized } = SecuxSOL.prepareSign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "delegate",
                            params: {
                                owner: from.toString(),
                                stake: stake.toString(),
                                vote: vote.toString()
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxSOL.resolveTransaction(rsp, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly sign", async () => {
                const { raw_tx } = await GetDevice().sign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "delegate",
                            params: {
                                owner: from.toString(),
                                stake: stake.toString(),
                                vote: vote.toString()
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const tx = solanaWeb3.Transaction.from(Buffer.from(signed, "hex"));
                assert.equal(tx.recentBlockhash, recentBlockhash, "recentBlockhash");
                assert.equal(tx.feePayer.toString(), from.toString(), "feePayer");

                const instruction = solanaWeb3.StakeProgram.delegate({
                    authorizedPubkey: from,
                    stakePubkey: stake,
                    votePubkey: vote
                });
                assert.equal(tx.instructions[0].programId.toString(), instruction.programId.toString(), "programId");
                assert.equal(tx.instructions[0].data.toString("hex"), instruction.data.toString("hex"), "data");
                for (let i = 0; i < instruction.keys.length; i++) {
                    const actual = tx.instructions[0].keys[i];
                    const expect = instruction.keys[i];
                    assert.equal(actual.pubkey.toString(), expect.toString(), `pubkey#${i}`);
                }
            });
        });

        describe("withdraw stake", () => {
            const path_from = `m/44'/501'/${RandomNumber(20)}'`;
            const key_from = derivePath(path_from, seed.toString("hex")).key;
            const from = solanaWeb3.Keypair.fromSeed(key_from).publicKey;
            const recentBlockhash = solanaWeb3.Keypair.generate().publicKey.toString();
            const stake = solanaWeb3.Keypair.generate().publicKey;
            const lamports = 1e9;

            let signed
            it("can create and sign transaction", async () => {
                const { commandData, serialized } = SecuxSOL.prepareSign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "withdraw",
                            params: {
                                owner: from.toString(),
                                stake: stake.toString(),
                                lamports
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxSOL.resolveTransaction(rsp, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly sign", async () => {
                const { raw_tx } = await GetDevice().sign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "withdraw",
                            params: {
                                owner: from.toString(),
                                stake: stake.toString(),
                                lamports
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const tx = solanaWeb3.Transaction.from(Buffer.from(signed, "hex"));
                assert.equal(tx.recentBlockhash, recentBlockhash, "recentBlockhash");
                assert.equal(tx.feePayer.toString(), from.toString(), "feePayer");

                const instruction = solanaWeb3.StakeProgram.withdraw({
                    authorizedPubkey: from,
                    stakePubkey: stake,
                    toPubkey: from,
                    lamports
                });
                assert.equal(tx.instructions[0].programId.toString(), instruction.programId.toString(), "programId");
                assert.equal(tx.instructions[0].data.toString("hex"), instruction.data.toString("hex"), "data");
                for (let i = 0; i < instruction.keys.length; i++) {
                    const actual = tx.instructions[0].keys[i];
                    const expect = instruction.keys[i];
                    assert.equal(actual.pubkey.toString(), expect.toString(), `pubkey#${i}`);
                }
            });
        });

        describe("deactivate stake", () => {
            const path_from = `m/44'/501'/${RandomNumber(20)}'`;
            const key_from = derivePath(path_from, seed.toString("hex")).key;
            const from = solanaWeb3.Keypair.fromSeed(key_from).publicKey;
            const recentBlockhash = solanaWeb3.Keypair.generate().publicKey.toString();
            const stake = solanaWeb3.Keypair.generate().publicKey;

            let signed
            it("can create and sign transaction", async () => {
                const { commandData, serialized } = SecuxSOL.prepareSign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "deactivate",
                            params: {
                                owner: from.toString(),
                                stake: stake.toString()
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                const rsp = await GetDevice().Exchange(commandData);
                signed = SecuxSOL.resolveTransaction(rsp, serialized);

                assert.exists(signed);
            }).timeout(10000);

            it("can directly sign", async () => {
                const { raw_tx } = await GetDevice().sign(from.toString(), {
                    recentBlockhash,
                    instructions: [
                        {
                            type: "deactivate",
                            params: {
                                owner: from.toString(),
                                stake: stake.toString()
                            }
                        }
                    ],
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                assert.equal(raw_tx, signed);
            }).timeout(10000);

            it("verify raw data of signed transaction", async () => {
                const tx = solanaWeb3.Transaction.from(Buffer.from(signed, "hex"));
                assert.equal(tx.recentBlockhash, recentBlockhash, "recentBlockhash");
                assert.equal(tx.feePayer.toString(), from.toString(), "feePayer");

                const instruction = solanaWeb3.StakeProgram.deactivate({
                    authorizedPubkey: from,
                    stakePubkey: stake
                });
                assert.equal(tx.instructions[0].programId.toString(), instruction.programId.toString(), "programId");
                assert.equal(tx.instructions[0].data.toString("hex"), instruction.data.toString("hex"), "data");
                for (let i = 0; i < instruction.keys.length; i++) {
                    const actual = tx.instructions[0].keys[i];
                    const expect = instruction.keys[i];
                    assert.equal(actual.pubkey.toString(), expect.toString(), `pubkey#${i}`);
                }
            });
        });
    });

    if (BROADCAST) {
        describe("broadcast transaction", () => {
            const path_from = `m/44'/501'/8'`;
            const key_from = derivePath(path_from, seed.toString("hex")).key;
            const from = solanaWeb3.Keypair.fromSeed(key_from).publicKey;
            const api = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl("devnet"), "confirmed");

            if (AIRDROP) {
                it("can receive airdrop", async () => {
                    const airdropSignature = await api.requestAirdrop(from, solanaWeb3.LAMPORTS_PER_SOL);
                    await api.confirmTransaction(airdropSignature);
                }).timeout(30000);
            }


            it("can sign and broadcast transaction", async () => {
                const recentBlockhash = (await api.getRecentBlockhash("confirmed")).blockhash;
                const { raw_tx } = await GetDevice().sign(from.toString(), {
                    recentBlockhash,
                    instructions: SecuxSOL.Action.transferToken(
                        {
                            to: "J6yvNwvqVukGFMkBt2FvzbYVDDmM8cUbFNgWMk3EbK42",
                            owner: from.toString(),
                            amount: 1e4,
                            mint: "HdJ8pzRMFquse6MAdLTm2JHum51WFkocZX8YzXpPjNpG",
                            decimal: 6,
                            createAccount: true
                        },
                    ),
                    ownerships: [
                        { path: path_from, account: from.toString() }
                    ]
                });

                console.log(Buffer.from(raw_tx, "hex").toString("base64"));

                const signature = await solanaWeb3.sendAndConfirmRawTransaction(api, Buffer.from(raw_tx, "hex"));
                console.log(signature);
            }).timeout(60000);
        });
    }
}

function RandomNumber(max) {
    const value = Math.floor(Math.random() * max);
    return value.toString();
}

function randomString(length) {
    return Math.random().toString(36).substring(2, length).split("")
        .map(e => Math.random() < Math.random() ? e.toUpperCase() : e)
        .join().replaceAll(",", "");
}
