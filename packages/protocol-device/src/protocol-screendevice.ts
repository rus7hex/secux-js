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


import { buildPathBuffer, owTool } from "@secux/utility";
import {
    communicationData, getBuffer, ow_communicationData, Send, StatusCode, toAPDUResponse, TransportStatusError, wrapResult
} from "@secux/utility/lib/communication";
import {
    AccountInfo, DeleteOption, ow_AccountNormal, ow_AccountPath, ow_AccountToken, ow_DeleteOption
} from "./interface";
import { SecuxDevice } from "./protocol-device";
import { ITransport } from "@secux/transport";
import ow from "ow";


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


        const isToken = (info.contract) ? 1 : 0;
        const tokenBuffer = Buffer.alloc(2);
        tokenBuffer.writeUInt16LE(isToken);

        const chainIdBuffer = Buffer.alloc(2);
        chainIdBuffer.writeUInt16LE(info.chainId);

        const balanceBuffer = Buffer.alloc(32);
        balanceBuffer.write(info.balance, "ascii");

        const nameBuffer = Buffer.alloc(16);
        nameBuffer.write(info.name, "ascii");

        let data = Buffer.concat([
            tokenBuffer,
            chainIdBuffer,
            buildPathBuffer(info.path, 3).pathBuffer,
            balanceBuffer,
            nameBuffer
        ]);

        if (isToken) {
            const contractBuffer = Buffer.alloc(42);
            contractBuffer.write(info.contract!, "ascii");

            const decimalBuffer = Buffer.alloc(1);
            decimalBuffer.writeInt8(info.decimal!);

            data = Buffer.concat([
                data,
                contractBuffer,
                decimalBuffer
            ]);
        }

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


        const isToken = (option?.contract) ? 1 : 0;
        const tokenBuffer = Buffer.alloc(2);
        tokenBuffer.writeUInt16LE(isToken);

        const chainIdBuffer = Buffer.alloc(2);
        chainIdBuffer.writeUInt16LE(option.chainId);

        let data = Buffer.concat([
            tokenBuffer,
            chainIdBuffer,
            buildPathBuffer(path, 3).pathBuffer
        ]);

        if (isToken) {
            const contractBuffer = Buffer.alloc(42);
            contractBuffer.write(option.contract!, "ascii");

            data = Buffer.concat([
                data,
                contractBuffer
            ]);
        }

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
     * @returns {number} info.chainId
     * @returns {string} info.balance
     * @returns {string} [info.contract]
     * @returns {number} [info.decimal]
     */
    static resolveAccountInfo(response: communicationData): AccountInfo {
        ow(response, ow_communicationData);


        const rsp = toAPDUResponse(getBuffer(response));
        if (rsp.status !== StatusCode.SUCCESS) throw new TransportStatusError(rsp.status);

        const isToken = rsp.data.readUInt16LE(0);
        const chainId = rsp.data.readUInt16LE(2);
        const purpose = checkHardened(rsp.data.readUInt32LE(4));
        const coinType = checkHardened(rsp.data.readUInt32LE(8));
        const account = checkHardened(rsp.data.readUInt32LE(12));
        const balance = Buffer.from(rsp.data.slice(16, 48).filter(x => x !== 0)).toString("ascii");
        const name = Buffer.from(rsp.data.slice(48, 64).filter(x => x !== 0)).toString("ascii");

        let info: any = {
            name,
            path: `m/${purpose}/${coinType}/${account}`,
            chainId,
            balance
        };

        if (isToken) {
            info.contract = Buffer.from(rsp.data.slice(64, 64 + 42).filter(x => x !== 0)).toString("ascii");
            info.decimal = rsp.data.readInt8(64 + 42);
        }

        return wrapResult(info);
    }

    /**
     * Query account info from device
     * @param {ITransport} trans 
     * @param {QueryObject} query
     */
    static async QueryAccountInfo(trans: ITransport, query: QueryObject): Promise<AccountInfo | undefined> {
        ow(query, ow_QueryObject);


        let buf = this.prepareGetAccountSize();
        let rsp = await trans.Exchange(getBuffer(buf));
        const size = this.resolveAccountSize(rsp);

        for (let i = 0; i < size; i++) {
            let buf = this.prepareGetAccountInfo(i);
            let rsp = await trans.Exchange(getBuffer(buf));
            const info = this.resolveAccountInfo(rsp);

            if (query.contract && query.contract !== info.contract) continue;
            if (info.path === query.path && info.chainId === query.chinId) return info;
        }

        return undefined;
    }

    /**
     * Query accounts from device by coin
     * @param {ITransport} trans 
     * @param {number} cointype BIP44 defined cointype
     * @param {number} chainId EIP155, for ethereum ecosystem
     * @returns 
     */
    static async QueryAccountInfoByCoin(trans: ITransport, cointype: number, chainId: number = 0): Promise<Array<AccountInfo>> {
        ow(cointype, ow.number.not.negative);
        ow(chainId, ow.optional.number.not.negative);


        const list: Array<AccountInfo> = [];
        let buf = this.prepareGetAccountSize();
        let rsp = await trans.Exchange(getBuffer(buf));
        const size = this.resolveAccountSize(rsp);

        for (let i = 0; i < size; i++) {
            let buf = this.prepareGetAccountInfo(i);
            let rsp = await trans.Exchange(getBuffer(buf));
            const info = this.resolveAccountInfo(rsp);

            if (
                info.chainId === chainId &&
                info.path.match(RegExp(`^m/[0-9]+[']?/${cointype}[']?/[0-9]+[']?$`))
            ) {
                list.push(info);
            }
        }

        return list;
    }
}

type QueryObject = {
    path: string,
    chinId: number | 0,
    contract?: string
};

const ow_QueryObject = ow.object.exactShape({
    path: ow_AccountPath,
    chainId: ow.optional.number.not.negative,
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