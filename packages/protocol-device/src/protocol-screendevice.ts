/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
Copyright Wu Tsung-Yu

Licensed under the Apache License, Version 2.0 (the License);
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an AS IS BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


import { BigIntToBuffer, buildPathBuffer, checkFWVersion, FirmwareType, owTool } from "@secux/utility";
import {
    communicationData, getBuffer, ow_communicationData, Send, StatusCode, toAPDUResponse, TransportStatusError,
    wrapResult
} from "@secux/utility/lib/communication";
import {
    AccountInfo, DeleteOption, ow_AccountNormal, ow_AccountPath, ow_AccountToken, ow_chainId, ow_DeleteOption
} from "./interface";
import { checkFwForUint64ChainId, SecuxDevice } from "./protocol-device";
import { BigNumber } from 'bignumber.js';
import ow from "ow";


const AccountSymbolField = {
    crypto: "2.25",
}

/**
 * SecuX protocol for device with screen
 */
export class SecuxScreenDevice {
    /**
     * Resolve response from device
     * @param {communicationData} response 
     */
    static readonly resolveResponse = SecuxDevice.resolveResponse;


    /**
     * Set account command
     * @param {AccountInfo} info account info
     * @returns {communicationData} buffer for send
     */
    static prepareSetAccount(info: AccountInfo): communicationData {
        ow(info, ow.any(ow_AccountNormal, ow_AccountToken));
        const data = SecuxScreenDevice.#accountData({ ...info, decimal: info.decimal ?? 0 });

        return Send(0x70, 0x82, 0, 0, data);
    }

    /**
     * Delete account command
     * @param {string} path BIP44
     * @param {DeleteOption} [option]
     * @returns {communicationData} buffer for send
     */
    static prepareDeleteAccount(path: string, option: DeleteOption = { chainId: 0 }): communicationData {
        ow(path, ow_AccountPath);
        ow(option, ow_DeleteOption);

        const data = SecuxScreenDevice.#accountData({
            path,
            chainId: option.chainId,
            contract: option.contract
        });

        return Send(0x70, 0x84, 0, 0, data);
    }

    /**
     * Query account amount command
     * @returns {number} total account
     */
    static prepareGetAccountSize(): communicationData {
        return Send(0x70, 0x87);
    }

    /**
     * Resolve account amount from device
     * @param {communicationData} response
     * @returns {number} account amount
     */
    static resolveAccountSize(response: communicationData): number {
        ow(response, ow_communicationData);


        const rsp = toAPDUResponse(getBuffer(response));
        if (rsp.status !== StatusCode.SUCCESS) throw new TransportStatusError(rsp.status);

        return rsp.data.readUInt32LE(0);
    }

    /**
     * Query account info command
     * @param {number} index index of account displayed on device
     * @returns {communicationData} buffer for send
     */
    static prepareGetAccountInfo(index: number): communicationData {
        ow(index, ow.number.not.negative);


        const indexBuffer = Buffer.alloc(4);
        indexBuffer.writeUInt32LE(index);

        return Send(0x70, 0x83, 0x01, 0x00, indexBuffer);
    }

    /**
     * Resolve Account Info from device
     * @param {communicationData} response 
     * @returns {object} info
     * @returns {string} info.name
     * @returns {string} info.path
     * @returns {number|string} info.chainId
     * @returns {string} info.balance
     * @returns {string} [info.contract]
     * @returns {number} [info.decimal]
     */
    static resolveAccountInfo(response: communicationData): AccountInfo {
        ow(response, ow_communicationData);

        const rsp = toAPDUResponse(getBuffer(response));
        if (rsp.status !== StatusCode.SUCCESS) throw new TransportStatusError(rsp.status);

        const isToken = rsp.data.readUInt8(0);
        const chainId = rsp.data.readUInt16LE(2);
        const purpose = checkHardened(rsp.data.readUInt32LE(4));
        const coinType = checkHardened(rsp.data.readUInt32LE(8));
        const account = checkHardened(rsp.data.readUInt32LE(12));
        const name = Buffer.from(rsp.data.slice(48, 64).filter(x => x !== 0)).toString("ascii");
        let decimal = rsp.data.readUInt8(64 + 42);

        let balance = '', symbol = '';
        const balanceBuffer = rsp.data.slice(16, 48);
        if (balanceBuffer[0] <= 0x7f) {
            [balance, symbol] = Buffer.from(balanceBuffer.filter(x => x !== 0)).toString("ascii").split(' ');
            //@ts-ignore
            decimal = decimal || undefined;
            if (decimal) balance = BigNumber(balance).times(`1e${decimal}`).toFixed(0, 1);
        }
        else {
            // [FLAG:1][amount:24][symbol:7]
            const hexValue = balanceBuffer.slice(1, -7).reverse().toString("hex");
            balance = BigNumber(`0x${hexValue}`).toString(10);
            symbol = Buffer.from(balanceBuffer.slice(-7).filter(x => x !== 0)).toString("ascii");
        }

        const info: AccountInfo = {
            name,
            path: `m/${purpose}/${coinType}/${account}`,
            chainId,
            balance,
            symbol,
            decimal
        };

        if (isToken) {
            info.contract = Buffer.from(rsp.data.slice(64, 64 + 42).filter(x => x !== 0)).toString("ascii");
        }

        if (chainId === 0xffff) {
            const offset = 64 + 42 + 1;
            // backward compatible
            info.chainId = 0xffff;

            try {
                const chainId = rsp.data.readBigUInt64LE(offset);
                if (chainId !== BigInt(0)) info.chainId = `0x${chainId.toString(16)}`;
            } catch (error) {
                // do nothing
            }
        }

        return wrapResult(info);
    }

    static #accountData(info: {
        path: string,
        chainId: number | string | undefined,
        name?: string,
        balance?: string,
        symbol?: string,
        contract?: string,
        decimal?: number,
    }): Buffer {
        const isToken = (info.contract) ? 1 : 0;
        const accountData: Array<number> = [];
        if (info.name && info.balance) {
            try {
                const { ITransport } = require("@secux/transport");
                //@ts-ignore
                checkFWVersion(FirmwareType.mcu, AccountSymbolField[ITransport.deviceType], ITransport.mcuVersion);

                accountData.push(
                    0xff,
                    ...BigIntToBuffer(info.balance, 24, true),
                    ...asciiToArray(info.symbol!, 7),
                );
            }
            catch (error) {
                // 1. Transport library not imported
                // 2. Firmware version too old
                // 3. Amount bigger than 24 bytes

                let amount = BigNumber(info.balance).div(`1e${info.decimal}`).toString(10);
                if (isToken) {
                    const exceed = 32 - amount.length - info.symbol!.length - 1;
                    if (exceed < 0) amount = amount.slice(0, exceed);
                    accountData.push(
                        ...asciiToArray(`${amount} ${info.symbol!}`, 32),
                    );
                }
                else {
                    accountData.push(
                        ...asciiToArray(amount, 32),
                    );
                }
            }

            accountData.push(...asciiToArray(info.name, 16));
        }

        // decimal field is defined only on set account command.
        const tokenData = new Uint8Array(42 + (info.decimal === undefined ? 0 : 1));
        if (isToken) tokenData.set(asciiToArray(info.contract!, 42));
        if (info.decimal) tokenData[42] = info.decimal;

        const chainId = new BigNumber(info.chainId ?? 0);
        if (chainId.lte(0xffff)) {
            return Buffer.from([
                isToken, 0x00,
                ...BigIntToBuffer(info.chainId ?? 0, 2, true),
                ...buildPathBuffer(info.path, 3).pathBuffer,
                ...accountData,
                ...tokenData,
            ]);
        }

        checkFwForUint64ChainId();

        return Buffer.from([
            isToken, 0x00,
            0xff, 0xff,
            ...buildPathBuffer(info.path, 3).pathBuffer,
            ...accountData,
            ...tokenData,
            ...BigIntToBuffer(info.chainId!, 8, true)
        ]);
    }
}

try {
    const { ITransport } = require("@secux/transport");
    const { DeviceType } = require("@secux/transport/lib/interface");

    Object.defineProperties(ITransport.prototype, {
        setAccount: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                if (ITransport.deviceType === DeviceType.nifty) throw Error("Nifty wallet does not support this command.");

                //@ts-ignore
                const buf = SecuxScreenDevice.prepareSetAccount(...args);
                await this.Exchange(getBuffer(buf));
            }
        },

        deleteAccount: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                if (ITransport.deviceType === DeviceType.nifty) throw Error("Nifty wallet does not support this command.");

                //@ts-ignore
                const buf = SecuxScreenDevice.prepareDeleteAccount(...args);
                await this.Exchange(getBuffer(buf));
            }
        },

        getAccountSize: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]): Promise<number> {
                if (ITransport.deviceType === DeviceType.nifty) throw Error("Nifty wallet does not support this command.");

                //@ts-ignore
                const buf = SecuxScreenDevice.prepareGetAccountSize(...args);
                const rsp = await this.Exchange(getBuffer(buf));
                return SecuxScreenDevice.resolveAccountSize(rsp);
            }
        },

        getAccountInfo: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]): Promise<AccountInfo> {
                if (ITransport.deviceType === DeviceType.nifty) throw Error("Nifty wallet does not support this command.");

                //@ts-ignore
                const buf = SecuxScreenDevice.prepareGetAccountInfo(...args);
                const rsp = await this.Exchange(getBuffer(buf));
                return SecuxScreenDevice.resolveAccountInfo(rsp);
            }
        },

        queryAccountInfo: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (query: QueryObject): Promise<AccountInfo | undefined> {
                ow(query, ow_QueryObject);

                const size = await this.getAccountSize();
                for (let i = 0; i < size; i++) {
                    const info = await this.getAccountInfo(i);

                    if (query.contract && query.contract !== info.contract) continue;
                    if (info.path === query.path &&
                        (!query.chainId || BigNumber(info.chainId!).eq(query.chainId))) return info;
                }

                return undefined;
            }
        },

        queryAccountInfoByCoin: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (cointype: number, chainId?: number | string): Promise<Array<AccountInfo>> {
                ow(cointype, ow.number.not.negative);
                ow(chainId, ow.any(ow.undefined, ow_chainId));

                const list: Array<AccountInfo> = [];
                const size = await this.getAccountSize();
                for (let i = 0; i < size; i++) {
                    const info = await this.getAccountInfo(i);

                    if (
                        (!chainId || BigNumber(info.chainId!).eq(chainId)) &&
                        info.path.match(RegExp(`^m/[0-9]+[']?/${cointype}[']?/[0-9]+[']?$`))
                    ) {
                        list.push(info);
                    }
                }

                return list;
            }
        }
    });
} catch (error) {
    // skip plugin injection 
}


type QueryObject = {
    path: string,
    chinId: number | string | undefined,
    contract?: string
};

const ow_QueryObject = ow.object.exactShape({
    path: ow_AccountPath,
    chainId: ow.any(ow.undefined, ow_chainId),
    contract: ow.any(ow.undefined, owTool.hashString)
});

function checkHardened(value: number) {
    const HARDENED_OFFSET = 0x80000000;

    if (value >= HARDENED_OFFSET) {
        value = value - HARDENED_OFFSET;
        return `${value}'`;
    } else {
        return `${value}`;
    }
}

function asciiToArray(str: string, alloc: number) {
    const chars = new Uint8Array(alloc);
    for (let i = 0; i < Math.min(str.length, alloc); i++) {
        chars[i] = str.charCodeAt(i);
    }

    return chars;
}