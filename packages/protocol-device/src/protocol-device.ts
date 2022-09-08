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


import { BigIntToBuffer, buildPathBuffer, isSupportedCoin, Logger, owTool } from "@secux/utility";
import {
    communicationData, getBuffer, ow_communicationData, Send, StatusCode, toAPDUResponse,
    toCommunicationData, TransportStatusError, wrapResult
} from "@secux/utility/lib/communication";
import {
    AddressOption, VersionInfo, WalletInfo, ow_AddressOption, ow_FileMode, FileMode, FileInfo,
    ow_FileInfo, ContentKey, FileDestination, FileType, FileAttachment, ow_FileAttachment, ow_filename
} from "./interface";
import ow from "ow";
export { SecuxDevice, SecuxDeviceNifty, VersionInfo, WalletInfo, AddressOption };
const logger = Logger?.child({ id: "protocol" });


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


/**
 * SecuX protocol for device management (Nifty)
 */
class SecuxDeviceNifty {
    static #filenameSize = 48;

    static prepareGetWalletInfo(): communicationData {
        const data = Buffer.from([0xf8, 0x00, 0x00, 0x00]);
        logger?.debug(`send data: ${data.toString("hex")}`);

        return toCommunicationData(data);
    }

    static resolveWalletInfo(response: communicationData): { PartNumber: string, SerialNumber: string, DeviceName: string } {
        ow(response, ow_communicationData);

        const data = getBuffer(response);
        if (data[1] !== 0x00) {
            throw Error(`Invalid response, expect command code 0x00, but got 0x${data[1].toString(16)}`);
        }

        const info = {
            PartNumber: '',
            SerialNumber: '',
            DeviceName: ''
        };

        const keyValueList = getBuffer(response).slice(4).toString("utf8").split(',');
        for (const keyValue of keyValueList) {
            const key = /^\d+=/.exec(keyValue)?.[0].slice(0, -1);
            const value = /\"(.*?)\"/.exec(keyValue)?.[1] ?? '';
            switch (key) {
                case "7":
                    info.PartNumber = value;
                    break;

                case "10":
                    info.DeviceName = value;
                    break;

                case "11":
                    info.SerialNumber = value;
                    break;
            }
        }

        return wrapResult(info);
    }

    static prepareSetWalletName(name: string): communicationData {
        const nameBuf = Buffer.from(name, "utf8");
        ow(name, ow.string.nonEmpty.is(_ => nameBuf.length < 13));

        const data = Buffer.from([
            0xf8, 0x09,
            0x00, 0x00,
            ...nameBuf, 0x00
        ]);
        logger?.debug(`send data: ${data.toString("hex")}`);

        return toCommunicationData(data);
    }

    static prepareRestart(): communicationData {
        const data = Buffer.from([0xf8, 0x0a, 0x00, 0x00]);
        logger?.debug(`send data: ${data.toString("hex")}`);

        return toCommunicationData(data);
    }

    static prepareFileOperation(mode: FileMode, info: FileInfo): communicationData {
        ow(mode, ow_FileMode);
        ow(info, ow_FileInfo);

        const nameBuffer = Buffer.allocUnsafe(SecuxDeviceNifty.#filenameSize);
        Buffer.from(info.name, "utf8").copy(nameBuffer);

        const attachment: number[] = [];
        if (info.attachment) {
            const map: Array<string> = [];
            for (const field of Object.keys(info.attachment)) {
                //@ts-ignore
                const key = ContentKey[field];
                //@ts-ignore
                const value = info.attachment[field];

                if (key && value) map.push(`${key}="${value}"`);
            }
            const content = map.join(',');
            const contentBuffer = Buffer.from(content, "utf8");
            if (contentBuffer.length > 4095) throw Error("ArgumentError: content length exceeds 4095");

            const size = 6 + contentBuffer.length + 1;
            attachment.push(
                ...BigIntToBuffer(size, 2, true),
                ...BigIntToBuffer(info.attachment.type, 2, true),
                ...contentBuffer, 0x00,
                0x15, 0xae,
                0x00, 0x00
            );
        }

        const data = Buffer.from([
            0xf8, 0x04,
            mode, 0x00,
            ...BigIntToBuffer(info.size, 4, true),
            info.destination,
            info.type,
            info.attachment ? 0x01 : 0x00,
            0x00,
            ...nameBuffer,
            ...attachment
        ]);
        logger?.debug(`send data: ${data.toString("hex")}`);

        return toCommunicationData(data);
    }

    static prepareAddToGallery(filename: string, file: communicationData, attachment: FileAttachment, destination = FileDestination.GALLERY): Array<communicationData> {
        ow(filename, ow.string.nonEmpty);
        ow(file, ow_communicationData);
        ow(attachment, ow_FileAttachment);

        const supported = ["png", "jpg", "jpeg"];
        const extract = /(.*)\.(\w+)$/.exec(filename);
        if (!extract) throw Error(`ArgumentError: missing file extension, got "${file}"`);

        let [_, name, ext] = extract;
        if (!supported.includes(ext.toLowerCase())) {
            throw Error(`ArgumentError: unsupported file extension, got ".${ext}"`);
        }
        ext = ext.toLowerCase();
        if (ext === "jpeg") ext = "jpg";

        const operation = SecuxDeviceNifty.prepareFileOperation(
            FileMode.ADD,
            {
                size: getBuffer(file).length,
                destination,
                //@ts-ignore
                type: FileType[ext],
                name: `${name}.${ext}`,
                attachment
            }
        );
        const blocks = SecuxDeviceNifty.prepareSendFile(file);

        return [
            operation,
            ...blocks
        ];
    }

    static prepareFinishSync(): communicationData {
        const data = Buffer.from([0xf8, 0x03, 0x01, 0x00]);
        logger?.debug(`send data: ${data.toString("hex")}`);

        return toCommunicationData(data);
    }

    static prepareRemoveFromGallery(filename: string): communicationData {
        ow(filename, ow.string.nonEmpty);

        return SecuxDeviceNifty.prepareFileOperation(
            FileMode.REMOVE,
            {
                size: 0,
                destination: FileDestination.GALLERY,
                type: 0,
                name: filename
            }
        );
    }

    static resolveFileRemoved(response: communicationData): number {
        ow(response, ow_communicationData);

        const data = getBuffer(response);
        if (data[1] !== 0x04) {
            throw Error(`Invalid response, expect command code 0x04, but got 0x${data[1].toString(16)}`);
        }

        return data.readUint16LE(2);
    }

    static prepareListGalleryFiles(): communicationData {
        return SecuxDeviceNifty.prepareFileOperation(
            FileMode.READ,
            {
                size: 0,
                destination: FileDestination.GALLERY,
                type: 0,
                name: "*.png|*.jpg"
            }
        );
    }

    static resolveFilesInFolder(response: communicationData): { files: Array<string>, resume?: communicationData } {
        ow(response, ow_communicationData);

        const data = getBuffer(response);
        if (data[1] !== 0x04) {
            throw Error(`Invalid response, expect command code 0x04, but got 0x${data[1].toString(16)}`);
        }

        let resume = undefined, trim = 1;
        // need to send another command (4k buffer restriction on device)
        if (data[data.length - 2] === 0x1c) {
            const command = getBuffer(SecuxDeviceNifty.prepareListGalleryFiles());
            command[3] = 0x01;

            resume = toCommunicationData(command);
            trim++;
        }

        // c-string from device
        const content = data.slice(4, -trim).toString("utf8");

        return {
            files: content.split(','),
            resume
        }
    }

    static prepareUpdateGalleryTable(fileList: Array<string>, destination = FileDestination.GALLERY): Array<communicationData> {
        ow(fileList, ow.array.maxLength(200).ofType(ow_filename));

        const table = Buffer.from(fileList.map(x => `${x}\n`).join(), "utf8");
        const operation = SecuxDeviceNifty.prepareFileOperation(
            FileMode.ADD,
            {
                size: table.length,
                destination,
                type: FileType.hlt,
                name: ''
            }
        );
        const blocks = SecuxDeviceNifty.prepareSendFile(table);

        return [
            operation,
            ...blocks
        ]
    }

    static prepareResetGalleryTable(destination = FileDestination.GALLERY): communicationData {
        return SecuxDeviceNifty.prepareFileOperation(
            FileMode.REMOVE,
            {
                size: 0,
                destination,
                type: FileType.hlt,
                name: ''
            }
        );
    }

    static prepareSendFile(file: communicationData): Array<communicationData> {
        ow(file, ow_communicationData);

        const commands: Array<Buffer> = [];
        const data = getBuffer(file);
        const blockSize = 4096;
        let offset = 0;
        while (offset < data.length - blockSize) {
            commands.push(Buffer.from([
                0xf8, 0x07,
                0x00, 0x00,
                ...data.slice(offset, offset + blockSize)
            ]));
            offset += blockSize;
        }
        commands.push(Buffer.from([
            0xf8, 0x07,
            0x01, 0x00,
            ...data.slice(offset, data.length)
        ]));

        return commands.map(x => toCommunicationData(x));
    }
}