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


import { buildPathBuffer, isSupportedCoin, owTool } from "@secux/utility";
import {
    communicationData, getBuffer, ow_communicationData, Send, StatusCode, toAPDUResponse, TransportStatusError, wrapResult
} from "@secux/utility/lib/communication";
import { AddressOption, VersionInfo, WalletInfo, ow_AddressOption } from "./interface";
import ow from "ow";
export { SecuxDevice, VersionInfo, WalletInfo, AddressOption };


/**
 * SecuX protocol for device management
 */
class SecuxDevice {
    /**
     * Get version information command.
     * @returns {communicationData} data for sending to device
     */
    static prepareGetVersion(): communicationData {
        return Send(0x70, 0x13);
    }

    /**
     * @typedef VersionInfo
     * @property {number} transportVersion
     * @property {string} seFwVersion
     * @property {string} mcuFwVersion
     * @property {string} bootloaderVersion
     */

    /**
     * Resolve version information from device.
     * @param {communicationData} response data from device
     * @returns {VersionInfo} object
     */
    static resolveVersion(response: communicationData): VersionInfo {
        ow(response, ow_communicationData);


        const rsp = toAPDUResponse(getBuffer(response));

        const versionCount = rsp.data.readUInt8(0);
        const versionData = rsp.data.slice(1);

        // first version is transportVersion, it's a number type and length is 1
        const transportVersion = versionData.readUInt8(1);

        let tmp = versionData.slice(1 + versionData.readUInt8(0));  // trim first version block
        let decode: Array<string> = [];
        let versionDataLength = tmp.length;
        while (versionDataLength > 0) {
            const versionLength = tmp.readUInt8(0);
            const version = tmp.slice(1, 1 + versionLength).toString();  // other version is string
            decode.push(version);

            tmp = tmp.slice(1 + versionLength);
            versionDataLength = versionDataLength - (1 + versionLength);
        }

        if (decode.length + 1 !== versionCount) throw new Error('Parsing Invalid Version');

        return wrapResult({
            transportVersion: transportVersion,
            seFwVersion: decode[0],
            mcuFwVersion: decode[1],
            bootloaderVersion: decode[2]
        });
    }

    /**
     * Get wallet information command.
     * @returns {communicationData} data for sending to device
     */
    static prepareGetWalletInfo(): communicationData {
        return Send(0x80, 0xb2, 3);
    }

    /**
     * @typedef WalletInfo
     * @property {number} walletIndex
     * @property {string} walletName
     * @property {number} walletStatus
     */

    /**
     * Resolve wallet information from device.
     * @param {communicationData} response data from device
     * @returns {WalletInfo} object
     */
    static resolveWalletInfo(response: communicationData): WalletInfo {
        ow(response, ow_communicationData);


        const rsp = toAPDUResponse(getBuffer(response));

        const walletStatus = rsp.data.readUInt8(0);
        const walletName = Buffer.from(rsp.data.slice(1, 33).filter(c => c !== 0)).toString();
        const walletIndex = rsp.data.readUInt32LE(33);

        return wrapResult({
            walletIndex,
            walletName,
            walletStatus
        });
    }

    /**
     * Show address command.
     * @param {string} path BIP32
     * @param {AddressOption} [option]
     * @returns {communicationData} data for sending to device
     */
    static prepareShowAddress(path: string, option?: AddressOption): communicationData {
        ow(path, owTool.bip32String);
        ow(option as AddressOption, ow.any(ow.undefined, ow_AddressOption));


        if (!isSupportedCoin(path)) throw Error(`ArgumentError: unsupport bip32 path, got "${path}"`);

        const transactionType = 0;  // Note: ignore in this command
        const compressed = true; // always compressed

        let data = Buffer.alloc(4);
        data.writeUInt16LE(transactionType, 0);
        data.writeUInt16LE(option?.chainId ?? 0, 2);
        data = Buffer.concat([data, buildPathBuffer(path).pathBuffer]);

        const p1 = (compressed) ? 0x01 : 0x00;
        const p2 = (option?.needToConfirm ?? true) ? 0x00 : 0x01;

        return Send(0x70, 0x86, p1, p2, data);
    }

    /**
     * Resolve response from device.
     * @param {communicationData} response data from device
     */
    static resolveResponse(response: communicationData) {
        ow(response, ow_communicationData);


        const rsp = toAPDUResponse(getBuffer(response));
        if (rsp.status !== StatusCode.SUCCESS) throw new TransportStatusError(rsp.status);
    }
}
