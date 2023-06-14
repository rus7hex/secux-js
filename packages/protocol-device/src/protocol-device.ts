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


import {
    BigIntToBuffer, buildPathBuffer, checkFWVersion, FirmwareType, isSupportedCoin, Logger, owTool
} from "@secux/utility";
import {
    communicationData, getBuffer, ow_communicationData, Send, StatusCode, toAPDUResponse,
    toCommunicationData, TransportStatusError, wrapResult
} from "@secux/utility/lib/communication";
import {
    AddressOption, VersionInfo, WalletInfo, ow_AddressOption, ow_FileMode, FileMode, FileInfo,
    ow_FileInfo, ContentKey, FileDestination, FileType, FileAttachment, ow_FileAttachment, ow_filename,
    AttachmentExt, WalletStatus
} from "./interface";
import { BigNumber } from 'bignumber.js';
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
     * Resolve wallet information from device.
     * @param {communicationData} response data from device
     * @returns {WalletInfo} object
     */
    static resolveWalletInfo(response: communicationData): WalletInfo {
        ow(response, ow_communicationData);


        const rsp = toAPDUResponse(getBuffer(response));

        let walletStatus = rsp.data.readUInt8(0);
        if (walletStatus & WalletStatus.LOGOUT) walletStatus = WalletStatus.LOGOUT;
        if (!WalletStatus[walletStatus]) walletStatus = WalletStatus.NO_SEED;

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

        let chainId = new BigNumber(option?.chainId ?? 0);
        const append: Array<number> = [];
        if (chainId.gte(0xffff)) {
            checkFwForUint64ChainId();

            chainId = new BigNumber(0xffff);
            append.push(...BigIntToBuffer(option!.chainId!, 8, true));
        }

        const data = Buffer.from([
            transactionType, 0x00,
            ...BigIntToBuffer(chainId.toNumber(), 2, true),
            ...buildPathBuffer(path).pathBuffer,
            ...append
        ]);

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

    static prepareGetCustomerId(): communicationData {
        return Send(0x70, 0x63);
    }

    static resolveCustomerId(response: communicationData): string {
        ow(response, ow_communicationData);

        const rsp = toAPDUResponse(getBuffer(response));
        const id = rsp.data.readUInt32LE();
        return `0x${id.toString(16).padStart(8, '0')}`;
    }
}


/**
 * SecuX protocol for device management (Nifty)
 */
class SecuxDeviceNifty {
    static #filenameSize = 48;

    /**
     * Get wallet information command.
     * @returns {communicationData} data for sending to device
     */
    static prepareGetWalletInfo(): communicationData {
        commandForNifty();

        const data = Buffer.from([0xf8, 0x00, 0x00, 0x00]);
        logger?.debug(`send data: ${data.toString("hex")}`);

        return toCommunicationData(data);
    }

    /**
     * Resolve wallet information from device.
     * @param {communicationData} response data from device
     * @returns {NiftyWalletInfo} object
     */
    static resolveWalletInfo(response: communicationData): { PartNumber: string, SerialNumber: string, DeviceName: string, CustomerId: string } {
        ow(response, ow_communicationData);

        const data = getBuffer(response);
        if (data[1] !== 0x00) {
            throw Error(`Invalid response, expect command code 0x00, but got 0x${data[1].toString(16)}`);
        }

        const info = {
            PartNumber: '',
            SerialNumber: '',
            DeviceName: '',
            CustomerId: '',
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

                case "12":
                    info.CustomerId = value;
            }
        }

        return wrapResult(info);
    }

    /**
     * Set device name.
     * @param {string} name custom device name
     * @returns {communicationData} data for sending to device
     */
    static prepareSetWalletName(name: string): communicationData {
        commandForNifty();

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

    /**
     * Reboot device.
     * @returns {communicationData} data for sending to device
     */
    static prepareReboot(): communicationData {
        commandForNifty();

        const data = Buffer.from([0xf8, 0x0a, 0x00, 0x00]);
        logger?.debug(`send data: ${data.toString("hex")}`);

        return toCommunicationData(data);
    }

    /**
     * Execution file command.
     * @param {FileMode} mode read/write/delete
     * @param {FileInfo} info object for file
     * @returns {communicationData} data for sending to device
     */
    static prepareFileOperation(mode: FileMode, info: FileInfo): communicationData {
        commandForNifty();

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

    /**
     * Store image file on device.
     * @param {string} filename file name
     * @param {communicationData} file file data
     * @param {FileAttachment} [attachment] file metadata
     * @param {FileDestination} destination default: GALLERY
     * @returns {Array<communicationData>} data for sending to device
     */
    static prepareSendImage(filename: string, file: communicationData, attachment?: FileAttachment, destination = FileDestination.GALLERY): Array<communicationData> {
        commandForNifty();

        ow(filename, ow.string.nonEmpty);
        ow(file, ow_communicationData);
        ow(attachment, ow.any(ow.undefined, ow_FileAttachment));

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

    /**
     * Finish file transmission to unlock touch screen.
     * @returns {communicationData} data for sending to device
     */
    static prepareFinishSync(): communicationData {
        commandForNifty();

        const data = Buffer.from([0xf8, 0x03, 0x01, 0x00]);
        logger?.debug(`send data: ${data.toString("hex")}`);

        return toCommunicationData(data);
    }

    /**
     * Set profile picture on device.
     * @param {communicationData} file file data
     * @returns {Array<communicationData>} data for sending to device
     */
    static prepareUpdateProfileImage(file: communicationData): Array<communicationData> {
        return SecuxDeviceNifty.prepareSendImage(
            "/my_gallery.jpg",
            file,
            undefined,
            FileDestination.SDCARD
        );
    }

    /**
     * Remove files on deivce.
     * @param {string} filename filename or wildcard
     * @returns {communicationData} data for sending to device
     */
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

    /**
     * Number of files deleted.
     * @param {communicationData} response data from device
     * @returns {number} 
     */
    static resolveFileRemoved(response: communicationData): number {
        ow(response, ow_communicationData);

        const data = getBuffer(response);
        if (data[1] !== 0x04) {
            throw Error(`Invalid response, expect command code 0x04, but got 0x${data[1].toString(16)}`);
        }

        return data.readUint16LE(2);
    }

    /**
     * List files stored on device.
     * @returns {communicationData} data for sending to device
     */
    static prepareListGalleryFiles(): communicationData {
        try {
            return SecuxDeviceNifty.#prepareListGalleryFilesV2();
        } catch (error) {
            // do nothing
            logger.debug(`prepareListGalleryFilesV2 failed: \n${error}`);
        }

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

    static #prepareListGalleryFilesV2(): communicationData {
        checkFwForMultichainGallery();
        const chains = Object.values(AttachmentExt)
            .map(ext => `*.${ext}`)
            .join('|');

        return SecuxDeviceNifty.prepareFileOperation(
            FileMode.READ,
            {
                size: 0,
                destination: FileDestination.GALLERY,
                type: 0,
                name: chains
            }
        );
    }

    /**
     * Resolve file list.
     * @param {communicationData} response data from device
     * @returns {ListFilesObject} object
     */
    static resolveFilesInFolder(response: communicationData): { files: Array<string>, resume?: communicationData } {
        ow(response, ow_communicationData);

        const data = getBuffer(response);
        if (data[1] !== 0x04) {
            throw Error(`Invalid response, expect command code 0x04, but got 0x${data[1].toString(16)}`);
        }

        let resume: communicationData | undefined = undefined, trim = 1;
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

    /**
     * Arrange gallery on device.
     * @param {Array<string>} fileList file arranged list
     * @param {FileDestination} destination default: GALLERY
     * @returns {Array<communicationData>} data for sending to device
     */
    static prepareUpdateGalleryTable(fileList: Array<string>, destination = FileDestination.GALLERY): Array<communicationData> {
        ow(fileList, ow.array.maxLength(200).ofType(ow_filename));

        const table = Buffer.from(fileList.map(x => `${x}\n`).join(''), "utf8");
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

    /**
     * Reset arrangement on device.
     * @param {FileDestination} destination default: GALLERY
     * @returns {communicationData} data for sending to device
     */
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

    /**
     * Send file to device.
     * @param {communicationData} file file data
     * @returns {Array<communicationData>} data for sending to device
     */
    static prepareSendFile(file: communicationData): Array<communicationData> {
        commandForNifty();

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

const UInt64ChainId = {
    crypto: "2.24",
}
export function checkFwForUint64ChainId() {
    let ITransport;
    try {
        ITransport = require("@secux/transport").ITransport;
    } catch (error) {
        // Transport layer not found
        return;
    }
    if (!ITransport) return;

    //@ts-ignore
    checkFWVersion(FirmwareType.mcu, UInt64ChainId[ITransport.deviceType], ITransport.mcuVersion);
}

const MultichainGallery = {
    nifty: "2.07",
}
function checkFwForMultichainGallery() {
    let ITransport;
    try {
        ITransport = require("@secux/transport").ITransport;
    } catch (error) {
        // Transport layer not found
        return;
    }
    if (!ITransport) return;

    //@ts-ignore
    checkFWVersion(FirmwareType.mcu, MultichainGallery[ITransport.deviceType], ITransport.mcuVersion);
}

function commandForNifty() {
    let ITransport;
    try {
        ITransport = require("@secux/transport").ITransport;
    } catch (error) {
        // Transport layer not found
        return;
    }
    if (!ITransport) return;

    const { DeviceType } = require("@secux/transport/lib/interface");
    if (ITransport.deviceType !== DeviceType.nifty) {
        throw Error(`${ITransport.deviceType} wallet does not support this command.`);
    }
}

try {
    const { ITransport } = require("@secux/transport");
    const { DeviceType } = require("@secux/transport/lib/interface");

    Object.defineProperties(ITransport.prototype, {
        getVersion: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]): Promise<VersionInfo> {
                //@ts-ignore
                const buf = SecuxDevice.prepareGetVersion(...args);
                const rsp = await this.Exchange(getBuffer(buf));
                return SecuxDevice.resolveVersion(rsp);
            }
        },

        getWalletInfo: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                if (this.DeviceType === DeviceType.nifty) {
                    //@ts-ignore
                    const buf = SecuxDeviceNifty.prepareGetWalletInfo(...args);
                    const rsp = await this.Exchange(getBuffer(buf));
                    return SecuxDeviceNifty.resolveWalletInfo(rsp);
                }

                //@ts-ignore
                const buf = SecuxDevice.prepareGetWalletInfo(...args);
                const rsp = await this.Exchange(getBuffer(buf));
                return SecuxDevice.resolveWalletInfo(rsp);
            }
        },

        showAddress: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                //@ts-ignore
                const buf = SecuxDevice.prepareShowAddress(...args);
                await this.Exchange(getBuffer(buf));
            }
        },

        getCustomerId: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                if (this.DeviceType === DeviceType.nifty) {
                    //@ts-ignore
                    const buf = SecuxDeviceNifty.prepareGetWalletInfo(...args);
                    const rsp = await this.Exchange(getBuffer(buf));
                    const info = SecuxDeviceNifty.resolveWalletInfo(rsp);
                    return info.CustomerId;
                }

                //@ts-ignore
                const buf = SecuxDevice.prepareGetCustomerId(...args);
                const rsp = await this.Exchange(getBuffer(buf));
                return SecuxDevice.resolveCustomerId(rsp);
            }
        },

        setWalletName: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                //@ts-ignore
                const buf = SecuxDeviceNifty.prepareSetWalletName(...args);
                await this.Exchange(getBuffer(buf));
            }
        },

        reboot: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                //@ts-ignore
                const buf = SecuxDeviceNifty.prepareReboot(...args);
                await this.Exchange(getBuffer(buf));
            }
        },

        sendImage: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                ow(args[2], ow_FileAttachment);

                //@ts-ignore
                const bufList = SecuxDeviceNifty.prepareSendImage(...args);
                for (const buf of bufList) {
                    await this.Exchange(getBuffer(buf));
                }

                await this.finishSync();

                try {
                    checkFwForMultichainGallery();

                    // update gallery table (append)
                    const table = await this.listGalleryFiles();
                    const fileWithoutExt = /(.*)\.(\w+)$/.exec(args[0])![1];
                    const set = new Set(table);
                    set.add(`${fileWithoutExt}.${AttachmentExt[args[2].type]}`);
                    await this.updateGalleryTable([...set]);
                } catch (error) {
                    // do nothing
                    logger.debug(`update gallery table failed: \n${error}`);
                }
            }
        },

        removeFromGallery: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                //@ts-ignore
                const buf = SecuxDeviceNifty.prepareRemoveFromGallery(...args);
                const rsp = await this.Exchange(getBuffer(buf));
                return SecuxDeviceNifty.resolveFileRemoved(rsp);
            }
        },

        finishSync: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                //@ts-ignore
                const buf = SecuxDeviceNifty.prepareFinishSync(...args);
                await this.Exchange(getBuffer(buf));
            }
        },

        listGalleryFiles: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                //@ts-ignore
                const buf = SecuxDeviceNifty.prepareListGalleryFiles(...args);
                const rsp = await this.Exchange(getBuffer(buf));

                let fileList: string[] = [];
                let { files, resume } = SecuxDeviceNifty.resolveFilesInFolder(rsp);
                while (resume) {
                    fileList = fileList.concat(files);

                    const rsp = await this.Exchange(resume);
                    ({ files, resume } = SecuxDeviceNifty.resolveFilesInFolder(rsp));
                }
                fileList = fileList.concat(files);

                return fileList;
            }
        },

        updateProfileImage: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                //@ts-ignore
                const dataList = SecuxDeviceNifty.prepareUpdateProfileImage(...args);
                for (const buf of dataList) {
                    await this.Exchange(getBuffer(buf));
                }
            }
        },

        updateGalleryTable: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                //@ts-ignore
                const bufList = SecuxDeviceNifty.prepareUpdateGalleryTable(...args);
                for (const buf of bufList) {
                    await this.Exchange(getBuffer(buf));
                }
            }
        },

        resetGalleryTable: {
            enumerable: true,
            configurable: false,
            writable: false,
            value: async function (...args: any[]) {
                //@ts-ignore
                const buf = SecuxDeviceNifty.prepareResetGalleryTable(...args);
                await this.Exchange(getBuffer(buf));
            }
        }
    });
} catch (error) {
    // skip plugin injection
}


/**
 * Data type for transmission.
 * @typedef {string|Buffer} communicationData
 */

/**
 * Wallet status.
 * @typedef {enum} WalletStatus
 * @property {number} NotActivated 0
 * @property {number} Normal 34
 * @property {number} Hidden 98
 */

/**
 * File operations.
 * @typedef {enum} FileMode
 * @property {number} ADD 0
 * @property {number} REMOVE 1
 * @property {number} READ 2
 */

/**
 * File destination.
 * @typedef {enum} FileDestination
 * @property {number} SDCARD 0
 * @property {number} LOGO 1
 * @property {number} CONFIRM 2
 * @property {number} GALLERY 3
 */

/**
 * File type.
 * @typedef {enum} FileType
 * @property {number} png 0
 * @property {number} bpp1 1
 * @property {number} bpp2 2
 * @property {number} bpp4 3
 * @property {number} wav 4
 * @property {number} jpg 5
 * @property {number} hlt 6
 */

/**
 * Attachment type for specific chain.
 * @typedef {enum} AttachmentType
 * @property {number} Ethereum 1
 * @property {number} Polygon 2
 * @property {number} Solana 3
 * @property {numnber} BSC 4
 */

/**
 * Version information from device.
 * @typedef {object} VersionInfo
 * @property {number} transportVersion communication protocol version
 * @property {string} seFwVersion security chip firmware version
 * @property {string} mcuFwVersion firmware version
 * @property {string} bootloaderVersion bootloader version
 */

/**
 * Wallet information from device.
 * @typedef {object} WalletInfo
 * @property {number} walletIndex
 * @property {string} walletName custom name on deivce
 * @property {number} walletStatus wallet status
 */

/**
 * Options for showing address on device.
 * @typedef AddressOption
 * @property {boolean} [needToConfirm] need user interaction or not
 * @property {number} [chainId] chainId for evm-compatible chain
 */

/**
 * Wallet information from device.
 * @typedef {object} NiftyWalletInfo
 * @property {string} PartNumber part number on device
 * @property {string} SerialNumber serial number on device
 * @property {string} DeviceName custom name on deivce
 * @property {string} CustomerId customer id on device
 */

/**
 * Object for file attribute.
 * @typedef {object} FileInfo
 * @property {number} size file size
 * @property {FileDestination} destination file destination
 * @property {FileType} type file type
 * @property {string} name file name
 * @property {FileAttachment} [attachment] file metadata
 */

/**
 * Asset's metadata.
 * @typedef {object} FileAttachment
 * @property {AttachmentType} type metadata for specific chain
 * @property {string} contractAddress collection address
 * @property {string} tokenId asset id
 * @property {string} assetName asset name
 * @property {string} collectionName collection name
 * @property {string} tokenStandard asset based on which standard
 * @property {string} [uri] asset link
 */

/**
 * Object for get files stored on device.
 * @typedef {object} ListFilesObject
 * @property {Array<string>} files file list
 * @property {communicationData} [resume] exist when sending next command to device needed
 */