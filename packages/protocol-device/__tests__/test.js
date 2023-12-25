const { SecuxDevice, SecuxDeviceNifty } = require("@secux/protocol-device");
const { SecuxScreenDevice } = require("@secux/protocol-device/lib/protocol-screendevice");
const { SecuxUpdate } = require("@secux/protocol-device/lib/protocol-update");
const { AttachmentType, FileDestination } = require("@secux/protocol-device/lib/interface");
const { WalletStatus, SEMode } = require("@secux/protocol-device/lib/interface");
const { SecuxWebUSB } = require("@secux/transport-webusb");
const { BigNumber } = require("bignumber.js");
const { assert } = require("chai");


export function test(GetDevice) {
    describe("SecuxDevice", () => {
        describe('SecuxDevice.showAddress()', () => {
            it('query receiving address of "m/49\'/145\'/0\'/0"', async () => {
                const buf = SecuxDevice.prepareShowAddress("m/49'/145'/0'/0/0", {
                    needToConfirm: false
                });
                const rsp = await GetDevice().Exchange(buf);
                SecuxDevice.resolveResponse(rsp);
            }).timeout(10000);

            delay(2000);

            it('query receiving address of "m/44\'/60\'/0\'/0"', async () => {
                const buf = SecuxDevice.prepareShowAddress("m/44'/60'/0'/0/0", {
                    chainId: 1
                });
                const rsp = await GetDevice().Exchange(buf);
                SecuxDevice.resolveResponse(rsp);
            }).timeout(10000);

            delay(2000);

            const invalid_path = "m/44\'/123\'/0\'/0";
            it(`should failed by query receiving address of "${invalid_path}"`, async () => {
                try {
                    const buf = SecuxDevice.prepareShowAddress(invalid_path);
                    const rsp = await GetDevice().Exchange(buf);
                    SecuxDevice.resolveResponse(rsp);
                } catch (error) {
                    return;
                }

                assert.fail();
            });

            delay(2000);

            it('query receiving address of "m/44\'/60\'/0\'/0" with big chainId', async () => {
                const buf = SecuxDevice.prepareShowAddress("m/44'/60'/0'/0/0", {
                    needToConfirm: false,
                    chainId: 0xffaabbff
                });
                const rsp = await GetDevice().Exchange(buf);
                SecuxDevice.resolveResponse(rsp);
            }).timeout(10000);
        });

        describe('SecuxDevice.getVersion()', () => {
            it('query SE firmware version', async () => {
                const buf = SecuxDevice.prepareGetVersion();
                const rsp = await GetDevice().Exchange(buf);
                const { seFwVersion } = SecuxDevice.resolveVersion(rsp);

                assert.equal(seFwVersion, '1.87');
            });

            it('query MCU firmware version', async () => {
                const buf = SecuxDevice.prepareGetVersion();
                const rsp = await GetDevice().Exchange(buf);
                const { mcuFwVersion } = SecuxDevice.resolveVersion(rsp);

                assert.equal(mcuFwVersion, '2.14.9');
            });

            it('query BootLoader version', async () => {
                const buf = SecuxDevice.prepareGetVersion();
                const rsp = await GetDevice().Exchange(buf);
                const { bootloaderVersion } = SecuxDevice.resolveVersion(rsp);

                assert.equal(bootloaderVersion, '1.9');
            });

            it('query device type', async () => {
                const buf = SecuxDevice.prepareGetVersion();
                const rsp = await GetDevice().Exchange(buf);
                const { model } = SecuxDevice.resolveVersion(rsp);

                assert.equal(model, 1);
            });
        });

        describe('SecuxDevice.getWalletInfo()', () => {
            it('query Wallet Index', async () => {
                const buf = SecuxDevice.prepareGetWalletInfo();
                const rsp = await GetDevice().Exchange(buf);
                const { walletIndex } = SecuxDevice.resolveWalletInfo(rsp);

                assert.equal(walletIndex, 0);
            });

            it('query Wallet Name', async () => {
                const buf = SecuxDevice.prepareGetWalletInfo();
                const rsp = await GetDevice().Exchange(buf);
                const { walletName } = SecuxDevice.resolveWalletInfo(rsp);

                assert.equal(walletName, 'SecuX_Wallet');
            });

            it('query Wallet Status', async () => {
                const buf = SecuxDevice.prepareGetWalletInfo();
                const rsp = await GetDevice().Exchange(buf);
                const { walletStatus } = SecuxDevice.resolveWalletInfo(rsp);

                assert.equal(walletStatus, WalletStatus.NORMAL);
            });
        });

        describe("device information", () => {
            it("model", async () => {
                const model = await GetDevice().getModel();
                console.log("model:", model);
                assert.exists(model);
            });

            it("device id", async () => {
                const deviceId = await GetDevice().getDeviceId();
                console.log("deviceId:", deviceId);
                assert.exists(deviceId);
            });

            it("customer id", async () => {
                const id = await GetDevice().getCustomerId();
                console.log("customerId:", id);
                assert.exists(id);
            });
        });
    });

    describe("SecuxDeviceNifty", () => {
        const img = Buffer.from(
            "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",
            "base64"
        );
        const img2 = Buffer.from(
            "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",
            "base64"
        )

        it("query wallet info", async () => {
            const data = SecuxDeviceNifty.prepareGetWalletInfo();
            const rsp = await GetDevice().Exchange(data);
            const info = SecuxDeviceNifty.resolveWalletInfo(rsp);

            console.log(info.DeviceName);
            console.log(info.PartNumber);
            console.log(info.SerialNumber);
        });

        it("sync image to gallery", async () => {
            await GetDevice().sendImage(
                "sandman.jpg",
                img,
                {
                    assetName: "asset",
                    collectionName: "collection",
                    tokenStandard: "standard",
                    type: AttachmentType.Ethereum,
                    contractAddress: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
                    tokenId: "0x21de",
                }
            );
        }).timeout(10000);

        it("sync image to logo", async () => {
            await GetDevice().sendImage(
                'sandman.jpg',
                img,
                undefined,
                FileDestination.LOGO
            );
        }).timeout(10000);

        it("list files in gallery", async () => {
            const data = SecuxDeviceNifty.prepareListGalleryFiles();
            const rsp = await GetDevice().Exchange(data);

            let fileList = [];
            let { files, resume } = SecuxDeviceNifty.resolveFilesInFolder(rsp);
            while (resume) {
                fileList = fileList.concat(files);

                const rsp = await GetDevice().Exchange(resume);
                ({ files, resume } = SecuxDeviceNifty.resolveFilesInFolder(rsp));
            }
            fileList = fileList.concat(files);

            console.log(fileList.join(", "));
            console.log(fileList.length);
        });

        it("reset gallery table", async () => {
            const data = SecuxDeviceNifty.prepareResetGalleryTable();
            await GetDevice().Exchange(data);
        });

        it("shuffle gallery", async () => {
            const files = await GetDevice().listGalleryFiles();
            shuffle(files);

            await GetDevice().updateGalleryTable(files);
        })

        it("add new NFT that has not synced", async () => {
            const files = await GetDevice().listGalleryFiles();
            files.push("4nd3rs0n.jpg");

            await GetDevice().updateGalleryTable(files);
        });

        it("hide new NFT that has not synced", async () => {
            const files = await GetDevice().listGalleryFiles();
            files.shift();

            await GetDevice().updateGalleryTable(files);
        });

        it("remove image from gallery", async () => {
            const op = SecuxDeviceNifty.prepareRemoveFromGallery("*");
            const rsp = await GetDevice().Exchange(op);
            const deleted = SecuxDeviceNifty.resolveFileRemoved(rsp);
            console.log(deleted);
        }).timeout(600000);

        it("update profile image", async () => {
            const dataList = SecuxDeviceNifty.prepareUpdateProfileImage(img2);
            for (const data of dataList) await GetDevice().Exchange(data);
        }).timeout(10000);

        it("set wallet name", async () => {
            const data = SecuxDeviceNifty.prepareSetWalletName("n0sr3dn4");
            const rsp = await GetDevice().Exchange(data);
            console.log(rsp);
        });

        it("reboot device", async () => {
            const data = SecuxDeviceNifty.prepareReboot();
            const rsp = await GetDevice().Exchange(data);
            console.log(rsp);
        });
    });

    describe("SecuxScreenDevice", () => {
        let addInfo = [];
        describe("SecuxScreenDevice.SetAccount()", () => {
            describe("BTC Account", () => {
                const n = RandomNumber(20);
                const name = `BTC ${n}`;
                const path = `m/44'/0'/${n}'`;
                const balance = RandomNumber(1e16);
                const balance_update = RandomNumber(1e16);
                const decimal = 8;
                const symbol = "BTC";
                addInfo.push({
                    name,
                    path,
                    chainId: 0,
                    balance_update
                });

                let pre_size;
                it(`create a BTC account on SecuX device (${name}: ${balance} BTC)`, async () => {
                    let buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance, decimal, symbol });
                    let rsp = await GetDevice().Exchange(buf);
                    SecuxScreenDevice.resolveResponse(rsp);

                    buf = SecuxScreenDevice.prepareGetAccountSize();
                    rsp = await GetDevice().Exchange(buf);
                    pre_size = SecuxScreenDevice.resolveAccountSize(rsp);
                });

                delay(5000);

                it(`update balance (${name}: ${balance_update} BTC)`, async () => {
                    let buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance: balance_update, decimal, symbol });
                    let rsp = await GetDevice().Exchange(buf);
                    SecuxScreenDevice.resolveResponse(rsp);

                    buf = SecuxScreenDevice.prepareGetAccountSize();
                    rsp = await GetDevice().Exchange(buf);
                    const size = SecuxScreenDevice.resolveAccountSize(rsp);
                    assert.equal(size, pre_size);
                });

                delay(5000);
            });

            describe("ETH Account", () => {
                const n = RandomNumber(20);
                const name = `ETH ${n}`;
                const path = `m/44'/60'/${n}'`;
                const balance = RandomNumber(1e26);
                const chainId = 1;
                const decimal = 18;
                const symbol = "ETH";
                addInfo.push({
                    name,
                    path,
                    chainId,
                    balance
                });

                it(`create a ETH account on SecuX device (${name}: ${balance} ETH)`, async () => {
                    const buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance, chainId, decimal, symbol });
                    const rsp = await GetDevice().Exchange(buf);
                    SecuxScreenDevice.resolveResponse(rsp);
                });

                delay(5000);
            });

            describe("Uniswap token", () => {
                const n = RandomNumber(20);
                const name = `UNI ${n}`;
                const path = `m/44'/60'/${n}'`;
                const balance = RandomNumber(1e22);
                const chainId = 1;
                const contract = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
                const decimal = 18;
                const symbol = "UNI";
                addInfo.push({
                    name,
                    path,
                    chainId,
                    balance,
                    contract,
                    decimal
                });

                it(`create a Uniswap account on SecuX device (${name}: ${balance} UNI)`, async () => {
                    const buf = SecuxScreenDevice.prepareSetAccount({
                        name,
                        path,
                        balance,
                        chainId,
                        contract,
                        decimal,
                        symbol
                    });
                    const rsp = await GetDevice().Exchange(buf);
                    SecuxScreenDevice.resolveResponse(rsp);
                });

                delay(5000);
            });

            describe("BSC Account", () => {
                const n = RandomNumber(20);
                const name = `BSC ${n}`;
                const path = `m/44'/60'/${n}'`;
                const balance = RandomNumber(1e24);
                const chainId = 56;
                const decimal = 18;
                const symbol = "BNB";
                addInfo.push({
                    name,
                    path,
                    chainId,
                    balance
                });

                it(`create a BSC account on SecuX device (${name}: ${balance} BNB)`, async () => {
                    const buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance, chainId, decimal, symbol });
                    const rsp = await GetDevice().Exchange(buf);
                    SecuxScreenDevice.resolveResponse(rsp);
                });

                delay(5000);
            });

            describe("BNB Account", () => {
                const n = RandomNumber(20);
                const name = `BNB ${n}`;
                const path = `m/44'/714'/${n}'`;
                const balance = RandomNumber(1e12);
                const decimal = 8;
                const symbol = "BNB";
                addInfo.push({
                    name,
                    path,
                    chainId: 0,
                    balance
                });

                it(`create a BNB account on SecuX device (${name}: ${balance} BNB)`, async () => {
                    const buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance, decimal, symbol });
                    const rsp = await GetDevice().Exchange(buf);
                    SecuxScreenDevice.resolveResponse(rsp);
                });

                delay(5000);
            });

            describe("ADA Account", () => {
                const n = RandomNumber(20);
                const name = `ADA ${n}`;
                const path = `m/1852'/1815'/${n}'`;
                const balance = RandomNumber(1e14);
                const decimal = 6;
                const symbol = "ADA";
                addInfo.push({
                    name,
                    path,
                    chainId: 0,
                    balance
                });

                it(`Create a ADA account on SecuX device (${name}: ${balance} ADA)`, async () => {
                    const buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance, decimal, symbol });
                    const rsp = await GetDevice().Exchange(buf);
                    SecuxScreenDevice.resolveResponse(rsp);
                });

                delay(5000);
            });
        });

        describe("SecuxScreenDevice.QueryAccountInfoByCoin()", () => {
            it("can query btc accounts", async () => {
                const list = await GetDevice().queryAccountInfoByCoin(0);
                for (const info of list) {
                    console.log(`check account of [${info.name}][${info.balance}]`);
                }

                info_need_update = list[0];
            });

            let info_need_update;
            const balance_update = RandomNumber(1e23);
            it(`can update balance (${balance_update} BTC)`, async () => {
                let buf = SecuxScreenDevice.prepareSetAccount({ ...info_need_update, balance: balance_update });
                let rsp = await GetDevice().Exchange(buf);
                SecuxScreenDevice.resolveResponse(rsp);

                console.log(`account: ${info_need_update.name}`);
            });

            delay(5000);

            it("can query eth accounts", async () => {
                const list = await GetDevice().queryAccountInfoByCoin(60);
                for (const info of list) {
                    console.log(`check account of [${info.name}][${info.balance}]`);
                    console.log(info);
                }
            });

            it("can query bsc accounts", async () => {
                const list = await GetDevice().queryAccountInfoByCoin(60, 56);
                for (const info of list) {
                    console.log(`check account of [${info.name}][${info.balance}]`);
                }
            });
        });

        describe("SecuxScreenDevice.DeleteAccount()", () => {
            for (const info of addInfo) {
                it(`delete accounts added by test (${info.name})`, async () => {
                    const buf = SecuxScreenDevice.prepareDeleteAccount(info.path, { chainId: info.chainId, contract: info.contract });
                    const rsp = await GetDevice().Exchange(buf);
                    SecuxScreenDevice.resolveResponse(rsp);
                });

                delay(5000);
            }
        });
    });

    describe("SecuxUpdate", () => {
        if (GetDevice !== undefined) {
            describe('SecuxUpdate.EnterMCUBootloader()', () => {
                it('can enter MCU Bootloader', async () => {
                    const success = await SecuxUpdate.EnterMCUBootloader(GetDevice());

                    assert.equal(success, true);
                }).timeout(5000);
            });
        }

        describe("SecuxUpdate.UpdateMCU()", () => {
            let firmware;
            it("can get mcu firmware file from server", async () => {
                const fetchURL = "https://wsweb-sandbox.secuxtech.com/firmware/latest";
                const rsp = await fetch(fetchURL, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    method: 'POST',
                    body: JSON.stringify({
                        model: GetDevice().Model,
                        type: "mcu",
                    })
                });

                const { mcu_file } = await rsp.json();
                firmware = Buffer.from(mcu_file, "base64");

                assert.isTrue(firmware.length > 0);
            }).timeout(10000);

            it("click to update", () => {
                document.getElementById("connect").innerText = "Connect For Update";
                document.getElementById("connect").onclick = async () => {
                    await SecuxUpdate.UpdateMCU(
                        firmware,
                        GetDevice() instanceof SecuxWebUSB,
                        (status) => {
                            document.getElementById("status").textContent = `update progress: ${status}`;
                            console.log(status);
                        }
                    );

                    document.getElementById("status").textContent = `update progress: 100`;
                };
            });
        });
    });

    describe("SecuxUpdate", () => {
        describe("SecuxUpdate.getSEModeState()", async () => {
            it('SE in normal mode', async () => {
                const { mode } = await SecuxUpdate.getSEModeState(GetDevice());

                assert.equal(mode, SEMode.NORMAL);
            });

            it('SE state should be 0', async () => {
                const { state } = await SecuxUpdate.getSEModeState(GetDevice());

                assert.equal(state, 0);
            });
        });

        describe('SecuxUpdate.EnterSEBootloader()', () => {
            it('can enter SE Bootloader', async () => {
                const rsp = await SecuxUpdate.EnterSEBootloader(GetDevice());

                assert.equal(rsp, true);
            }).timeout(5000);
        });

        describe("SecuxUpdate.UpdateSE()", () => {
            let firmware;
            it("can get se firmware file from server", async () => {
                const buf = SecuxDevice.prepareGetVersion();
                const response = await GetDevice().Exchange(buf);
                const { seFwVersion } = SecuxDevice.resolveVersion(response);

                const fetchURL = "https://firmware-test.secuxtech.com/firmware/downloadSE";
                const rsp = await fetch(fetchURL, {
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    method: 'POST',
                    body: JSON.stringify({
                        fileName: (seFwVersion === "S90") ? "HDW_COS_01_93_C6A" : "HDW_COS_01_93_B5P"
                    })
                });

                firmware = await rsp.json();

                console.log(firmware)

                assert.exists(firmware);
            }).timeout(30000);

            it("can update se firmware", async () => {
                await SecuxUpdate.UpdateSE(
                    GetDevice(),
                    firmware,
                    (status) => {
                        document.getElementById("status").textContent = `update progress: ${status}`
                        console.log(status);
                    }
                );
            }).timeout(600000);
        });
    });
};

function delay(interval) {
    it('delay for check', done => {
        setTimeout(() => done(), interval)

    }).timeout(interval + 100);
}

function RandomNumber(max, precision) {
    const decimal = BigNumber(max).e;
    const value = BigNumber.random(decimal).times(max).toFixed(precision || 0);
    return value.toString();
}

function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
}