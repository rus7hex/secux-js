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


import { DeviceType, IAPDUResponse, ProtocolV2, TransportConfig } from "./interface";
import { APDUResolver, BaseResolver, BaseResolverV2, CommandResolver, IResolver, IResponse, NotifyResolver, ResponseType } from "./resolver";
import { owTool, supported_coin } from "@secux/utility";
import { communicationData, getBuffer, Send, to_L1_APDU } from "@secux/utility/lib/communication";
import { Base58 } from "@secux/utility/lib/bs58";
import ow from "ow";
export { ITransport, IAPDUResponse };


const NotImplemented = Error("abstract method need to be implemented.");


/**
 * Middle layer between device and application
 */
abstract class ITransport {
    static readonly PROTOCOLv1 = 1;
    static readonly PROTOCOLv2 = 2;

    // cache device info
    static deviceType: DeviceType;
    static mcuVersion: string;
    static seVersion: string;

    OnNotification?: (data: Buffer) => void;
    autoApplyL1: boolean = true;


    /**
     * @constructor
     * @param {object} config 
     */
    constructor(config?: TransportConfig) {
        this.#fillup = true;
        this.#timeout = config?.timeout ?? 20000;

        this.#resolver = new CommandResolver(new BaseResolver());
        this.#appendL0 = (data: Buffer) => data;
    }

    /**
     * Connect to Secux Device
     */
    async Connect() { throw NotImplemented; }

    /**
     * Disconnect from Secux Device
     */
    async Disconnect() { throw NotImplemented; }

    /**
     * Write data to SecuX device
     * @param {Buffer} data
     */
    async Write(data: Buffer) { throw NotImplemented; }

    get Read() {
        return this.#Read;
    }

    get ReceiveData() {
        return this.#ReceiveData;
    }

    get Exchange() {
        return this.#Exchange;
    }

    get Send() {
        return this.#Send;
    }

    async getAddress(path: string, ...args: any[]): Promise<string> {
        return getPlugin(path).getAddress.call(this, path, ...args);
    }

    async getPublickey(path: string, ...args: any[]): Promise<string> {
        return getPlugin(path).getPublickey.call(this, path, ...args);
    }

    async getXPublickey(path: string, ...args: any[]): Promise<string> {
        return getPlugin(path).getXPublickey.call(this, path, ...args);
    }

    async sign(...args: any[]) {
        // utxo based blockchain
        if (typeof args[0] === "object") {
            const path = Array.isArray(args[0]) ? args[0][0].path : args[0].path;
            return getPlugin(path).sign.call(this, ...args);
        }

        // first parameter of solana is base58 string
        if (args[0].length >= 43 && args[0].length <= 44 && Base58.decodeUnsafe(args[0])) {
            return getModule(supported_coin.find(x => x.name === "solana")!).sign.call(this, ...args);
        }

        return getPlugin(args[0]).sign.call(this, ...args);
    }

    async signWithImage(imageName: string, imageData: communicationData, metadata: any, ...args: any[]) {
        let SecuxDeviceNifty;
        try {
            ({ SecuxDeviceNifty } = require("@secux/protocol-device"));
        } catch (error) {
            // do nothing
        }
        if (!SecuxDeviceNifty) {
            throw Error('The package "@secux/protocol-device" of verison above 3.1.0 needed.');
        }

        // prepare command data for image and check if device supported.
        const { AttachmentType, FileDestination } = require("@secux/protocol-device/lib/interface");
        const _metadata = {
            contractAddress: ' ',
            tokenId: ' ',
            type: metadata.type ?? AttachmentType.Ethereum,
            tokenStandard: ' ',
            ...metadata
        };
        const dataList = SecuxDeviceNifty.prepareSendImage(
            imageName,
            imageData,
            _metadata,
            FileDestination.CONFIRM
        );

        // begin signing
        this.#sendImage = false;
        const task = this.sign(...args);
        await new Promise(resolve => {
            const timer = setInterval(() => {
                if (this.#sendImage) {
                    resolve(1);
                    clearInterval(timer);
                }
            }, 100);
        });

        // send image
        for (const data of dataList) await this.Exchange(getBuffer(data));

        // user interaction
        const { raw_tx, signature } = await task;

        return { raw_tx, signature };
    }

    get version() { return this.#version ?? ITransport.PROTOCOLv1; }
    set version(value: number) {
        if (!!this.#version && this.#version !== value) throw Error("Protocol cannot change after setup.");

        this.#version = value;
        switch (value) {
            case ITransport.PROTOCOLv2:
                this.#resolver = new NotifyResolver(new APDUResolver(new BaseResolverV2()));
                this.#appendL0 = this.#appendL0V2;
                this.#fillup = false;
                break;
        }
    }

    get packetSize() { return this.#packetSize ?? 64; }
    set packetSize(value: number) {
        if (!!this.#packetSize && this.#packetSize !== value) throw Error("Packet size cannot change after setup.");

        this.#packetSize = value;
    }

    get CustomerId() { return ''; }
    get DeviceType() { return ''; }
    get DeviceId() { return ''; }
    get Model() { return ''; }
    get MCU() { return ''; }
    get SE() { return ''; }


    #version?: number;
    #fillup: boolean;
    #appendL0: (data: Buffer) => Buffer;
    #resolver: IResolver;
    #isRunning: boolean = false;
    #resovled: IResponse | null = null;
    #error: Error | null = null;
    #packetSize?: number;
    #timeout: number;
    #sendImage: boolean = false;


    async #Read(): Promise<Buffer> {
        let isTerminated = false;
        this.#resovled = null;

        setTimeout(() => {
            isTerminated = !this.#resovled?.data;
        }, this.#timeout);

        return await new Promise((resolve, reject) => {
            const timer = setInterval(() => {
                if (this.#resovled?.data) {
                    resolve(this.#resovled.data);
                    clearInterval(timer);
                }
                else if (isTerminated) {
                    reject(`TransferError: timeout (${this.#timeout} ms)`);
                    clearInterval(timer);
                }
            }, 1);
        });
    }

    #ReceiveData(data: Buffer) {
        if (data.length === 0) return;

        if (!IResolver.isRunning.call(this.#resolver)) {
            //@ts-ignore
            this.#resovled = {
                data,
                type: ResponseType.UNKNOWN
            };
            return;
        }

        try {
            this.#resovled = IResolver.handleData.call(this.#resolver, data);
            if (this.#resovled.type === ResponseType.NOTIFY) {
                // wait for notification to start sending image (nifty)
                this.#sendImage = true;
                this.OnNotification?.call(undefined, this.#resovled.data);
                return;
            }
            if (this.#resovled.data.length === 0) return;

            this.#error = null;
        } catch (error: any) {
            IResolver.resetAll.call(this.#resolver);
            this.#resovled = null;
            this.#error = error;
        }

        this.#isRunning = false;
    };

    async #Exchange(data: Buffer): Promise<Buffer> {
        this.#isRunning = true;

        let L1 = data;
        let isAPDU = false;
        if (this.#version === ITransport.PROTOCOLv2 && this.autoApplyL1 && data[0] !== 0xf8) {
            L1 = getBuffer(to_L1_APDU(data));
            isAPDU = true;
        }
        this.#resolver.Sent = L1;

        const L0 = this.#appendL0(L1);
        const packetBufferArray = this.#buildPacketBuffer(L0);
        for (const packetBuffer of packetBufferArray) {
            await this.Write(packetBuffer);
        }

        let isTerminated = false;
        if (!this.#disableTimeout()) {
            setTimeout(() => {
                isTerminated = true;
            }, this.#timeout);
        }

        await new Promise((resolve, reject) => {
            const timer = setInterval(() => {
                if (!this.#isRunning) {
                    resolve(1);
                    clearInterval(timer);
                }
                else if (isTerminated) {
                    reject(`TransferError: timeout (${this.#timeout} ms)`);
                    clearInterval(timer);
                }
            }, 1);
        });

        // when signing with image on nifty, it needs to skip the command for image.
        if (this.#version === ITransport.PROTOCOLv2 && isAPDU) {
            await new Promise((resolve, reject) => {
                const timer = setInterval(() => {
                    if (this.#resovled?.type === ResponseType.APDU || this.#error) {
                        resolve(1);
                        clearInterval(timer);
                    }
                    else if (isTerminated) {
                        reject(`TransferError: timeout (${this.#timeout} ms)`);
                        clearInterval(timer);
                    }
                }, 1);
            });
        }

        if (this.#error) throw this.#error;
        if (!this.#resovled) throw Error("TransferError: empty response");

        if (this.#version === ITransport.PROTOCOLv2 && this.#resovled.type === ResponseType.APDU) {
            return this.#resovled.data.slice(4);
        }

        return this.#resovled.data;
    }

    async #Send(cla: number, ins: number, p1: number = 0, p2: number = 0, data: Buffer = Buffer.alloc(0)): Promise<IAPDUResponse> {
        let buf = Send(cla, ins, p1, p2, data);
        if (this.#version === ITransport.PROTOCOLv2) buf = to_L1_APDU(buf);

        await this.Exchange(getBuffer(buf));

        return this.#resovled!.response;
    }

    #buildPacketBuffer(buffer: Buffer) {
        const packet = this.packetSize;
        const nBlocks = Math.ceil(buffer.length / packet);
        const blocks: Buffer[] = [];
        let offset = 0;
        for (let i = 0; i < nBlocks - 1; i++) {
            const chunkData = buffer.slice(offset, offset + packet);
            blocks.push(chunkData);

            offset += packet;
        }

        const last = buffer.slice(offset);
        if (!this.#fillup) {
            blocks.push(last);
            return blocks;
        }

        const remain = Buffer.alloc(packet);
        last.copy(remain);
        blocks.push(remain);

        return blocks;
    }

    #appendL0V2(data: Buffer): Buffer {
        const packet = this.packetSize - 1;
        const slices = Math.ceil(data.length / packet);
        const L0 = Buffer.allocUnsafe(data.length + slices);

        let offset = 0, serial = ProtocolV2.SERIAL_START;
        for (let i = 0; i < slices - 1; i++) {
            L0[offset++] = serial;
            if (++serial > ProtocolV2.SERIAL_END) serial = ProtocolV2.SERIAL_START;

            offset += data.copy(L0, offset, i * packet, (i + 1) * packet);
        }

        const remain = data.length % packet;
        L0[offset++] = remain;
        data.slice(-remain).copy(L0, offset);

        L0[0] += ProtocolV2.HEAD_PREFIX;

        return L0;
    }

    #disableTimeout(): boolean {
        if (this.#resolver.cla === 0x70) {
            switch (this.#resolver.ins) {
                case 0xa3:
                case 0xa4:
                case 0xa5:
                case 0xa6:
                case 0x86:
                    return true;
            }
        }

        if (this.version === ITransport.PROTOCOLv2) {
            if (this.#resolver.Sent[0] === 0xf8) {
                switch (this.#resolver.Sent[1]) {
                    // delete file from gallery
                    case 0x04:
                        return this.#resolver.Sent[2] === 0x01;
                }
            }
        }

        return false;
    }
}


/* class decorator */
export function staticImplements<T>() {
    return <U extends T>(constructor: U) => { constructor };
}

export interface IPlugin {
    getAddress(this: ITransport, path: string, ...args: any[]): Promise<string>;
    getPublickey(this: ITransport, path: string, ...args: any[]): Promise<string>;
    getXPublickey(this: ITransport, path: string, ...args: any[]): Promise<string>;
    sign(this: ITransport, ...args: any[])
        : Promise<
            { raw_tx: string, signature?: string } |
            { signature: string } |
            { multi_command: Array<communicationData> }
        >;
}

/**
 * @deprecated
 */
export function loadPlugin(plugin: Function, name: string) {
    //@ts-ignore
    if (ITransport[name] === undefined) {
        Object.defineProperty(ITransport, name, {
            enumerable: true,
            configurable: false,
            writable: false,
            value: plugin
        });
    }
}


function getPlugin(path: string) {
    ow(path, owTool.bip32String);

    const split = path.match(/\d+/g)!;
    const cointype = parseInt(split[1], 10);

    const item = supported_coin.find(x => x.cointype === cointype);
    if (!item) throw Error(`ArgumentError: unsupport cointype of path, got "${path}"`);

    return getModule(item);
}

function getModule(info: typeof supported_coin[0]) {
    //@ts-ignore
    const m = ITransport[info.module];
    if (!m) throw Error(`Cannot find plugin, please install npm package "${info.npm}" and import into your code.`);

    return m;
}
