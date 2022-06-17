const { StatusCode } = require("@secux/transport");
const { SecuxDevice } = require("@secux/protocol-device");
const { SecuxScreenDevice } = require("@secux/protocol-device/lib/protocol-screendevice");
const { SecuxUpdate } = require("@secux/protocol-device/lib/protocol-update");
const { SecuxWebUSB } = require("@secux/transport-webusb");
const { WalletStatus, SEMode } = require("@secux/protocol-device/lib/interface");
const { assert } = require("chai");


const Test_Device = true;
const Test_ScreenDevice = true;
const Test_ScreenDevice_SetAccount = false;
const Test_Update_MCU = false;
const Test_Update_SE = false;

export function test(GetDevice) {
    if (Test_Device) {
        describe("SecuxDevice", () => {
            describe('SecuxDevice.showAddress()', () => {
                it('query receiving address of "m/44\'/0\'/0\'/0"', async () => {
                    const buf = SecuxDevice.prepareShowAddress("m/44'/0'/0'/0/0", {
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
        });
    }


    if (Test_ScreenDevice) {
        describe("SecuxScreenDevice", () => {
            let addInfo = [];
            if (Test_ScreenDevice_SetAccount) {
                describe("SecuxScreenDevice.SetAccount()", () => {
                    describe("BTC Account", () => {
                        const n = RandomNumber(20);
                        const name = `BTC ${n}`;
                        const path = `m/44'/0'/${n}'`;
                        const balance = RandomNumber(1e8, 8);
                        const balance_update = RandomNumber(1e8, 8);
                        addInfo.push({
                            name,
                            path,
                            chainId: 0,
                            balance_update
                        });

                        let pre_size;
                        it(`create a BTC account on SecuX device (${name}: ${balance} BTC)`, async () => {
                            let buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance });
                            let rsp = await GetDevice().Exchange(buf);
                            SecuxScreenDevice.resolveResponse(rsp);

                            buf = SecuxScreenDevice.prepareGetAccountSize();
                            rsp = await GetDevice().Exchange(buf);
                            pre_size = SecuxScreenDevice.resolveAccountSize(rsp);
                        });

                        delay(10000);

                        it(`update balance (${name}: ${balance_update} BTC)`, async () => {
                            let buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance });
                            let rsp = await GetDevice().Exchange(buf);
                            SecuxScreenDevice.resolveResponse(rsp);

                            buf = SecuxScreenDevice.prepareGetAccountSize();
                            rsp = await GetDevice().Exchange(buf);
                            const size = SecuxScreenDevice.resolveAccountSize(rsp);
                            assert.equal(size, pre_size);
                        });

                        delay(10000);
                    });

                    describe("ETH Account", () => {
                        const n = RandomNumber(20);
                        const name = `ETH ${n}`;
                        const path = `m/44'/60'/${n}'`;
                        const balance = RandomNumber(1e8, 9);
                        const chainId = 1;
                        addInfo.push({
                            name,
                            path,
                            chainId,
                            balance
                        });

                        it(`create a ETH account on SecuX device (${name}: ${balance} ETH)`, async () => {
                            const buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance, chainId });
                            const rsp = await GetDevice().Exchange(buf);
                            SecuxScreenDevice.resolveResponse(rsp);
                        });

                        delay(10000);
                    });

                    describe("Uniswap token", () => {
                        const n = RandomNumber(20);
                        const name = `UNI ${n}`;
                        const path = `m/44'/60'/${n}'`;
                        const balance = RandomNumber(1e8, 9);
                        const chainId = 1;
                        const contract = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
                        const decimal = 18;
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
                                decimal
                            });
                            const rsp = await GetDevice().Exchange(buf);
                            SecuxScreenDevice.resolveResponse(rsp);
                        });

                        delay(10000);
                    });

                    describe("BSC Account", () => {
                        const n = RandomNumber(20);
                        const name = `BSC ${n}`;
                        const path = `m/44'/60'/${n}'`;
                        const balance = RandomNumber(1e8, 9);
                        const chainId = 56;
                        addInfo.push({
                            name,
                            path,
                            chainId,
                            balance
                        });

                        it(`create a BSC account on SecuX device (${name}: ${balance} BNB)`, async () => {
                            const buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance, chainId });
                            const rsp = await GetDevice().Exchange(buf);
                            SecuxScreenDevice.resolveResponse(rsp);
                        });

                        delay(10000);
                    });

                    describe("BNB Account", () => {
                        const n = RandomNumber(20);
                        const name = `BNB ${n}`;
                        const path = `m/44'/174'/${n}'`;
                        const balance = RandomNumber(1e8, 8);
                        addInfo.push({
                            name,
                            path,
                            chainId: 0,
                            balance
                        });

                        it(`create a BNB account on SecuX device (${name}: ${balance} BNB)`, async () => {
                            const buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance });
                            const rsp = await GetDevice().Exchange(buf);
                            SecuxScreenDevice.resolveResponse(rsp);
                        });

                        delay(10000);
                    });

                    describe("ADA Account", () => {
                        const n = RandomNumber(20);
                        const name = `ADA ${n}`;
                        const path = `m/44'/1815'/${n}'`;
                        const balance = RandomNumber(1e10, 6);
                        addInfo.push({
                            name,
                            path,
                            chainId: 0,
                            balance
                        });

                        it(`Create a ADA account on SecuX device (${name}: ${balance} ADA)`, async () => {
                            const buf = SecuxScreenDevice.prepareSetAccount({ name, path, balance });
                            const rsp = await GetDevice().Exchange(buf);
                            SecuxScreenDevice.resolveResponse(rsp);
                        });

                        delay(10000);
                    });
                });
            }

            describe("SecuxScreenDevice.QueryAccountInfoByCoin()", () => {
                it("can query btc accounts", async () => {
                    const list = await SecuxScreenDevice.QueryAccountInfoByCoin(GetDevice(), 0);
                    for (const info of list) {
                        console.log(`check account of [${info.name}][${info.balance}]`);
                    }

                    info_need_update = list[0];
                });

                let info_need_update;
                const balance_update = RandomNumber(1e8, 8);
                it(`can update balance (${balance_update} BTC)`, async () => {
                    let buf = SecuxScreenDevice.prepareSetAccount({ ...info_need_update, balance: balance_update });
                    let rsp = await GetDevice().Exchange(buf);
                    SecuxScreenDevice.resolveResponse(rsp);

                    console.log(`account: ${info_need_update.name}`);
                });

                delay(10000);

                it("can query eth accounts", async () => {
                    const list = await SecuxScreenDevice.QueryAccountInfoByCoin(GetDevice(), 60, 1);
                    for (const info of list) {
                        console.log(`check account of [${info.name}][${info.balance}]`);
                    }
                });

                it("can query bsc accounts", async () => {
                    const list = await SecuxScreenDevice.QueryAccountInfoByCoin(GetDevice(), 60, 56);
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

                    delay(10000);
                }
            });
        });
    }


    if (Test_Update_MCU) {
        describe("SecuxUpdate", () => {
            describe('SecuxUpdate.EnterMCUBootloader()', () => {
                it('can enter MCU Bootloader', async () => {
                    const rsp = await SecuxUpdate.EnterMCUBootloader(GetDevice());

                    assert.equal(rsp.status, StatusCode.SUCCESS);
                }).timeout(5000);
            });

            describe("SecuxUpdate.UpdateMCU()", () => {
                let firmware;
                it("can get mcu firmware file from server", async () => {
                    const fetchURL = "https://firmware.secuxtech.com/firmware/downloadMcu";
                    const rsp = await fetch(fetchURL, {
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        method: 'GET'
                    });

                    const data = await rsp.arrayBuffer();
                    firmware = new Uint8Array(data);

                    assert.isTrue(firmware.length > 0);
                }).timeout(10000);

                let device;
                it("click to update", () => {
                    document.getElementById("connect").innerText = "Connect For Update";
                    document.getElementById("connect").onclick = async () => {
                    await SecuxUpdate.UpdateMCU(
                        firmware,
                        (status) => console.log(status)
                    );
                    };
                });
            });
        });
    }

    if (Test_Update_SE) {
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

                    assert.equal(rsp.status, StatusCode.SUCCESS);
                }).timeout(5000);
            });

            describe("SecuxUpdate.UpdateSE()", () => {
                let firmware;
                it("can get se firmware file from server", async () => {
                    const { seFwVersion } = await SecuxDevice.getVersion(GetDevice());

                    const fetchURL = "https://firmware.secuxtech.com/firmware/downloadSE";
                    const rsp = await fetch(fetchURL, {
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        method: 'POST',
                        body: JSON.stringify({
                            fileName: (seFwVersion === "S90") ? "HDW_COS_01_87_C6A" : "HDW_COS_01_87_B5P"
                        })
                    });

                    firmware = await rsp.json();

                    assert.exists(firmware);
                }).timeout(30000);

                it("can update se firmware", async () => {
                    await SecuxUpdate.UpdateSE(
                        GetDevice(),
                        firmware,
                        (status) => console.log(status)
                    );
                }).timeout(90000);
            });
        });
    }
};

function delay(interval) {
    it('delay for check', done => {
        setTimeout(() => done(), interval)

    }).timeout(interval + 100);
}

function RandomNumber(max, precision) {
    const value = (Math.random() * max).toFixed(precision);
    return value.toString();
}