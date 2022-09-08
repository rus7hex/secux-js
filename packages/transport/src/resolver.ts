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


import { Logger } from "@secux/utility";
import { StatusCode, StatusCodeV2, TransportStatusError } from "@secux/utility/lib/communication";
import { IAPDUResponse, ProtocolV2 } from "./interface";
const logger = Logger?.child({ id: "resolver" });

const EMPTY_BUFFER = Buffer.alloc(0);
const EMPTY_RESPONSE: IAPDUResponse = {
    data: Buffer.alloc(0),
    dataLength: 0,
    status: 0
};


type IResponse = {
    data: Buffer,
    response: IAPDUResponse,
    isNotify: boolean
};

export abstract class IResolver {
    #next?: IResolver;
    #prev?: IResolver;
    #buffer: Array<Buffer> = [];
    #isRunning: boolean = false;
    #sent: Buffer = EMPTY_BUFFER;

    constructor(next?: IResolver) {
        this.#next = next;
        if (next) next.#prev = this;
    }

    abstract handleData(data: Buffer): IResponse;
    abstract toResponse(data: Buffer): IAPDUResponse;

    reset(): void {
        this.#buffer.length = 0;
        this.#sent = EMPTY_BUFFER;
        this.#isRunning = false;
    }

    protected toNext(data: Buffer): IResponse {
        if (this.#next) {
            return this.#next.handleData(data);
        }

        return { data: EMPTY_BUFFER, response: EMPTY_RESPONSE, isNotify: false };
    }

    get Next(): IResolver | undefined {
        return this.#next;
    }

    get Prev(): IResolver | undefined {
        return this.#prev;
    }

    get DataSource(): Array<Buffer> {
        return this.#buffer;
    }

    get Sent(): Buffer {
        return this.#sent;
    }
    set Sent(data: Buffer) {
        if (this.#isRunning) throw Error("ExecutionError: device does not support multi-tasking");

        this.#sent = data;
        this.#isRunning = true;

        if (this.#next) this.#next.Sent = data;
    }

    get cla(): number {
        if (this.#next) {
            const cla = this.#next.cla;
            if (cla !== 0) return cla;
        }

        return 0;
    }

    get ins(): number {
        if (this.#next) {
            const ins = this.#next.ins;
            if (ins !== 0) return ins;
        }

        return 0;
    }


    static handleData(this: IResolver, data: Buffer): IResponse {
        const result = this.handleData(data);
        if (!result.isNotify && result.data.length !== 0) {
            IResolver.resetAll.call(this);
        }

        return result;
    }

    static resetAll(this: IResolver) {
        let cur = this.#next;
        while (cur) {
            cur.reset();

            cur = cur.#next;
        }

        cur = this;
        while (cur) {
            cur.reset();

            cur = cur.#prev;
        }
    }
}

export class BaseResolver extends IResolver {
    handleData(data: Buffer): IResponse {
        this.DataSource.push(data);

        const buf = Buffer.concat(this.DataSource);
        const dataLength = buf.readUInt16LE(0);

        if (dataLength + 4 > buf.length) {
            return this.toNext(data);
        }

        return { data: buf, response: this.toResponse(buf), isNotify: false };
    }

    toResponse(data: Buffer): IAPDUResponse {
        const dataLength = data.readUInt16LE(0);

        return {
            dataLength,
            data: data.slice(2, dataLength),
            status: data.readUInt16BE(dataLength + 2)
        }
    }
}

export class CommandResolver extends BaseResolver {
    #cla: number = 0;
    #ins: number = 0;

    handleData(data: Buffer): IResponse {
        if (this.#cla === 0) return this.toNext(data);

        this.DataSource.push(data);

        let buf = EMPTY_BUFFER;
        let response = EMPTY_RESPONSE;

        // data_len(2) data(n) status(2) cla(1) ins(1)
        const dataLen = this.DataSource[0].readUint16LE(0);
        const received = this.DataSource.reduce((sum, x) => sum += x.length, 0);
        if (received >= dataLen + 6) {
            buf = Buffer.concat(this.DataSource).slice(0, dataLen + 6);

            const status = buf.readUInt16BE(buf.length - 4);
            const cla = buf.readUint8(buf.length - 2);
            const ins = buf.readUint8(buf.length - 1);
            if (cla !== this.#cla || ins !== this.#ins) {
                const message =
                    `expect command 0x${this.#cla.toString(16)} 0x${this.ins.toString(16)}, but got 0x${cla.toString(16)} 0x${ins.toString(16)}`;
                logger?.debug(message);
                if (status === StatusCode.SUCCESS) throw Error(`TransferError: ${message}`);
            }

            if (!Object.values(StatusCode).includes(status)) {
                const message = `invalid status: 0x${status.toString(16)}`;
                logger?.debug(message);
                throw Error(`TransferError: ${message}`);
            }

            if (status !== StatusCode.SUCCESS) {
                throw new TransportStatusError(status);
            }

            response = super.toResponse(buf);
        }

        return { data: buf, response, isNotify: false };
    }

    get Sent(): Buffer {
        return super.Sent;
    }
    set Sent(data: Buffer) {
        super.Sent = data;

        if (data.length < 12) {
            this.#cla = 0;
            this.#ins = 0;
            return;
        }

        this.#cla = data[0];
        if (this.#cla !== 0x70 && this.#cla !== 0x80) {
            this.#cla = 0;
            this.#ins = 0;
            return;
        }

        this.#ins = data[1];

        const dataLen = data.readUint16LE(4);
        if (data.length !== dataLen + 12) {
            this.#cla = 0;
            this.#ins = 0;
            return;
        }
    }

    get cla(): number {
        return this.#cla;
    }

    get ins(): number {
        return this.#ins;
    }
}


export class BaseResolverV2 extends IResolver {
    handleData(data: Buffer): IResponse {
        let header = data[0];
        if (header >= ProtocolV2.HEAD_PREFIX) {
            if (this.DataSource.length > 0) return this.toNext(data);

            header -= ProtocolV2.HEAD_PREFIX;
        }
        else {
            if (this.DataSource.length < 1) return this.toNext(data);
        }

        this.DataSource.push(data);
        if (header >= ProtocolV2.SERIAL_START) return this.toNext(data);

        try {
            const buf = this.unpack(this.DataSource);
            return { data: buf, response: this.toResponse(buf), isNotify: false };
        }
        catch (error: any) {
            if (error instanceof TransportStatusError) throw error;
            logger?.debug(error.message);
        }

        return this.toNext(data);
    }

    toResponse(data: Buffer): IAPDUResponse {
        const condition = data[0];
        if (condition !== StatusCodeV2.OK) throw new TransportStatusError(condition, 2);

        if (this.Sent.length > 0) {
            const cmd = this.Sent[1].toString(16);
            const cmd_recieved = data[1].toString(16);
            if (cmd !== cmd_recieved) {
                throw Error(`TransferError: expect response of command 0x${cmd}, but got 0x${cmd_recieved}`);
            }
        }

        return {
            dataLength: data.length,
            data,
            status: StatusCode.SUCCESS
        }
    }

    protected unpack(source: Array<Buffer>): Buffer {
        if (source.length === 0) throw Error("buffer is empty");

        const first = source[0];
        let serial = first[0];
        if (serial < ProtocolV2.HEAD_PREFIX) {
            throw Error(`invalid header of first packet: ${first.toString("hex")}`);
        }

        serial -= ProtocolV2.HEAD_PREFIX;
        if (serial < ProtocolV2.SERIAL_START) {
            if (source.length !== 1) {
                throw Error(`expect only one packet, but got ${source.length}, first packet: ${first.toString("hex")}`);
            }

            return first.slice(1, serial + 1);
        }
        if (source.length <= 1) {
            throw Error(`expect multiple packets, but got ${source.length}, first packet: ${first.toString("hex")}`);
        }

        const last = source[source.length - 1];
        serial = last[0];
        if (serial >= ProtocolV2.HEAD_PREFIX) {
            throw Error(`invalid header of last packet: ${last.toString("hex")}`);
        }
        const lastPacketLen = serial + 1;

        const unpacker: { [serial: number]: Array<Buffer> } = {};
        for (let i = ProtocolV2.SERIAL_START; i <= ProtocolV2.SERIAL_END; i++) unpacker[i] = [];
        for (const pack of source.slice(1, -1)) {
            let serial = pack[0];
            try {
                unpacker[serial].push(pack.slice(1));
            } catch (error) {
                throw Error(`invalid serial number of packet: ${pack.toString("hex")}`);
            }
        }

        const total = source.slice(0, -1).reduce((sum, x) => sum += x.length, 0) + lastPacketLen;
        const unpacked = Buffer.allocUnsafe(total - source.length);
        let offset = 0;
        offset += first.copy(unpacked, offset, 1);

        serial = ProtocolV2.SERIAL_START + 1;
        for (let i = 0; i < source.length - 2; i++) {
            try {
                offset += unpacker[serial].shift()!.copy(unpacked, offset);
            } catch (error) {
                throw Error(`lost packet #${i + 2} of ${source.length}`);
            }

            if (++serial > ProtocolV2.SERIAL_END) serial = ProtocolV2.SERIAL_START;
        }

        last.copy(unpacked, offset, 1, lastPacketLen + 1);

        return unpacked;
    }
}

export class APDUResolver extends BaseResolverV2 {
    #resolver = new CommandResolver();

    handleData(data: Buffer): IResponse {
        if (this.DataSource.length === 0) {
            if (data[0] < ProtocolV2.HEAD_PREFIX) return this.toNext(data);
            if (data[1] !== 0x00 || data[2] !== 0x02) return this.toNext(data);

            // need more packet
            this.DataSource.push(data);
            return this.toNext(data);
        }

        this.DataSource.push(data);

        let buf = EMPTY_BUFFER;
        let response = EMPTY_RESPONSE;
        try {
            buf = this.unpack(this.DataSource);
            response = this.toResponse(buf);
        } catch (error: any) {
            logger?.debug(error.message);
            if (buf.length > 0 && response.data.length < 1) throw error;
        }

        return { data: buf, response, isNotify: false };
    }

    toResponse(data: Buffer): IAPDUResponse {
        const payload = data.slice(4);
        return this.#resolver.handleData(payload).response;
    }

    reset(): void {
        super.reset();
        this.#resolver.reset();
    }

    get Sent(): Buffer {
        return super.Sent;
    }
    set Sent(data: Buffer) {
        super.Sent = data;
        this.#resolver.Sent = data.slice(4);
    }

    get cla(): number {
        return this.#resolver.cla;
    }

    get ins(): number {
        return this.#resolver.ins;
    }
}

export class NotifyResolver extends BaseResolverV2 {
    static readonly Notifys = 0xfc;

    handleData(data: Buffer): IResponse {
        if (data[0] < ProtocolV2.HEAD_PREFIX) return this.toNext(data);
        if (data[1] < NotifyResolver.Notifys) return this.toNext(data);

        try {
            const unpacked = this.unpack([data]);
            return { data: unpacked, response: this.toResponse(unpacked), isNotify: true };
        } catch (error: any) {
            logger?.debug(error.message);
        }

        return this.toNext(data);
    }

    toResponse(data: Buffer): IAPDUResponse {
        const condition = data[0];

        return {
            dataLength: data.length,
            data,
            status: (condition >= NotifyResolver.Notifys) ? StatusCode.SUCCESS : StatusCode.DATA_ERROR
        }
    }
}